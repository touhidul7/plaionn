begin;

-- Invoices for teams and players within a league season
create table public.league_invoices (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null,
  recipient_type text not null check(recipient_type in ('team', 'player')),
  team_entry_id uuid references public.team_entries(id),
  player_id uuid references public.players(id),
  title text not null check(length(trim(title)) between 2 and 150),
  amount_cents integer not null check(amount_cents > 0),
  amount_paid_cents integer not null default 0 check(amount_paid_cents >= 0 and amount_paid_cents <= amount_cents),
  currency text not null default 'CAD' check(length(currency) = 3),
  due_date date,
  status text not null default 'issued' check(status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  foreign key(season_id, league_id) references public.seasons(id, league_id),
  check((recipient_type = 'team' and team_entry_id is not null) or (recipient_type = 'player' and player_id is not null))
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  invoice_id uuid not null references public.league_invoices(id),
  amount_cents integer not null check(amount_cents > 0),
  payment_method text not null check(payment_method in ('etransfer', 'cash', 'cheque', 'credit_card', 'stripe')),
  reference_number text not null default '',
  notes text not null default '',
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);

create table public.billing_audit (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  invoice_id uuid not null references public.league_invoices(id),
  actor_id uuid not null references auth.users(id),
  action text not null check(action in ('created', 'payment_recorded', 'voided')),
  reason text not null check(length(trim(reason)) between 2 and 500),
  previous_state jsonb,
  new_state jsonb not null,
  changed_at timestamptz not null default now()
);

alter table public.league_invoices enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.billing_audit enable row level security;

revoke all on public.league_invoices, public.invoice_payments, public.billing_audit from anon, authenticated;
grant select on public.league_invoices, public.invoice_payments, public.billing_audit to authenticated;

-- Policies: Commissioners and finance operators can read and manage all league invoices
create policy invoices_read on public.league_invoices for select to authenticated
  using(
    public.is_league_commissioner(league_id)
    or exists(
      select 1 from public.league_memberships m
      where m.league_id = league_invoices.league_id
        and m.user_id = auth.uid()
        and m.role = 'finance'
    )
    or (
      recipient_type = 'player'
      and exists(
        select 1 from public.players p
        where p.id = league_invoices.player_id and p.owner_user_id = auth.uid()
      )
    )
  );

create policy invoice_payments_read on public.invoice_payments for select to authenticated
  using(
    public.is_league_commissioner(league_id)
    or exists(
      select 1 from public.league_memberships m
      where m.league_id = invoice_payments.league_id
        and m.user_id = auth.uid()
        and m.role = 'finance'
    )
  );

create policy billing_audit_read on public.billing_audit for select to authenticated
  using(public.is_league_commissioner(league_id));

-- RPC: Create team invoice
create or replace function public.create_team_invoice(
  target_entry uuid,
  invoice_title text,
  total_cents integer,
  invoice_due_date date
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  entry_record record;
  settings_record record;
  created_id uuid;
  invoice_currency text := 'CAD';
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Sign in required';
  end if;

  select e.id, e.league_id, d.season_id into entry_record
  from public.team_entries e
  join public.divisions d on d.id = e.division_id and d.league_id = e.league_id
  where e.id = target_entry;

  if entry_record.id is null then
    raise exception using errcode='P0002', message='TEAM_ENTRY_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(entry_record.league_id) and not exists(
    select 1 from public.league_memberships m
    where m.league_id = entry_record.league_id and m.user_id = auth.uid() and m.role = 'finance'
  ) then
    raise exception using errcode='42501', message='Commissioner or finance role required';
  end if;

  if invoice_title is null or length(trim(invoice_title)) not between 2 and 150 then
    raise exception using errcode='22023', message='Title must be between 2 and 150 characters';
  end if;

  if total_cents is null or total_cents <= 0 then
    raise exception using errcode='22023', message='Amount must be greater than zero';
  end if;

  select currency into invoice_currency
  from public.season_settings
  where season_id = entry_record.season_id and league_id = entry_record.league_id;

  if invoice_currency is null then
    invoice_currency := 'CAD';
  end if;

  insert into public.league_invoices(
    league_id, season_id, recipient_type, team_entry_id, title,
    amount_cents, amount_paid_cents, currency, due_date, status
  ) values (
    entry_record.league_id, entry_record.season_id, 'team', entry_record.id, trim(invoice_title),
    total_cents, 0, invoice_currency, invoice_due_date, 'issued'
  ) returning id into created_id;

  insert into public.billing_audit(
    league_id, invoice_id, actor_id, action, reason, previous_state, new_state
  ) values (
    entry_record.league_id, created_id, auth.uid(), 'created', 'Invoice issued to team entry',
    null, jsonb_build_object('title', trim(invoice_title), 'amount_cents', total_cents, 'status', 'issued')
  );

  return created_id;
end;
$$;

-- RPC: Record payment (offline reconciliation or payment settlement)
create or replace function public.record_invoice_payment(
  target_invoice uuid,
  payment_cents integer,
  pay_method text,
  ref_number text,
  payment_notes text
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  inv public.league_invoices;
  new_paid integer;
  new_status text;
  saved public.league_invoices;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Sign in required';
  end if;

  select * into inv from public.league_invoices where id = target_invoice for update;

  if inv.id is null then
    raise exception using errcode='P0002', message='INVOICE_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(inv.league_id) and not exists(
    select 1 from public.league_memberships m
    where m.league_id = inv.league_id and m.user_id = auth.uid() and m.role = 'finance'
  ) then
    raise exception using errcode='42501', message='Commissioner or finance role required';
  end if;

  if inv.status in ('paid', 'void') then
    raise exception using errcode='P0001', message='INVOICE_NOT_PAYABLE';
  end if;

  if payment_cents is null or payment_cents <= 0 then
    raise exception using errcode='22023', message='Payment must be greater than zero';
  end if;

  if inv.amount_paid_cents + payment_cents > inv.amount_cents then
    raise exception using errcode='22023', message='Payment exceeds outstanding balance';
  end if;

  if pay_method not in ('etransfer', 'cash', 'cheque', 'credit_card', 'stripe') then
    raise exception using errcode='22023', message='Invalid payment method';
  end if;

  new_paid := inv.amount_paid_cents + payment_cents;
  if new_paid = inv.amount_cents then
    new_status := 'paid';
  else
    new_status := 'partially_paid';
  end if;

  update public.league_invoices
  set amount_paid_cents = new_paid,
      status = new_status,
      revision = inv.revision + 1
  where id = target_invoice
  returning * into saved;

  insert into public.invoice_payments(
    league_id, invoice_id, amount_cents, payment_method, reference_number, notes, recorded_by
  ) values (
    inv.league_id, target_invoice, payment_cents, pay_method, coalesce(trim(ref_number), ''),
    coalesce(trim(payment_notes), ''), auth.uid()
  );

  insert into public.billing_audit(
    league_id, invoice_id, actor_id, action, reason, previous_state, new_state
  ) values (
    inv.league_id, target_invoice, auth.uid(), 'payment_recorded',
    'Recorded payment of ' || (payment_cents::numeric / 100)::text || ' via ' || pay_method,
    to_jsonb(inv), to_jsonb(saved)
  );

  return saved.revision;
end;
$$;

-- RPC: Get team billing summary
create or replace function public.get_team_billing_summary(target_entry uuid)
returns table(
  total_billed_cents bigint,
  total_paid_cents bigint,
  balance_cents bigint,
  invoice_count bigint,
  currency text
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  tenant uuid;
  inv_curr text := 'CAD';
begin
  select league_id into tenant from public.team_entries where id = target_entry;

  if auth.uid() is null or tenant is null or not public.is_league_member(tenant) then
    raise exception using errcode='42501', message='League membership required';
  end if;

  return query
  select
    coalesce(sum(amount_cents), 0)::bigint as total_billed_cents,
    coalesce(sum(amount_paid_cents), 0)::bigint as total_paid_cents,
    coalesce(sum(amount_cents - amount_paid_cents), 0)::bigint as balance_cents,
    count(*)::bigint as invoice_count,
    coalesce(min(i.currency), 'CAD') as currency
  from public.league_invoices i
  where i.team_entry_id = target_entry and i.status <> 'void';
end;
$$;

revoke all on function public.create_team_invoice(uuid, text, integer, date),
  public.record_invoice_payment(uuid, integer, text, text, text),
  public.get_team_billing_summary(uuid) from public, anon, authenticated;

grant execute on function public.create_team_invoice(uuid, text, integer, date),
  public.record_invoice_payment(uuid, integer, text, text, text),
  public.get_team_billing_summary(uuid) to authenticated;

commit;

