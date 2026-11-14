-- ============================================================================
-- Migration: 202611160015_officials_payroll_and_certifications.sql
-- Description: Officials certifications, availability, game rate cards,
--              and automated game payroll calculations with payout tracking.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Official Profiles & Rate Cards
-- ----------------------------------------------------------------------------
create table if not exists public.official_profiles (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  certification_level text not null default 'Level 1' check (
    certification_level in (
      'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Master Official', 'Timekeeper Cert'
    )
  ),
  certification_expiry date,
  referee_fee_cents integer not null default 4500 check (referee_fee_cents >= 0),
  timekeeper_fee_cents integer not null default 3000 check (timekeeper_fee_cents >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists idx_official_profiles_league on public.official_profiles(league_id, is_active);

alter table public.official_profiles enable row level security;

drop policy if exists official_profiles_read on public.official_profiles;
create policy official_profiles_read on public.official_profiles
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = official_profiles.league_id and lm.role = 'commissioner'
    )
  );

drop policy if exists official_profiles_manage on public.official_profiles;
create policy official_profiles_manage on public.official_profiles
  for all using (
    auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = official_profiles.league_id and lm.role = 'commissioner'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Official Payroll Ledger
-- ----------------------------------------------------------------------------
create table if not exists public.official_payroll (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('referee', 'timekeeper')),
  slot text not null check (slot in ('referee_1', 'referee_2', 'timekeeper')),
  fee_cents integer not null check (fee_cents >= 0),
  payment_status text not null default 'pending' check (
    payment_status in ('pending', 'approved', 'paid', 'disputed')
  ),
  payout_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create index if not exists idx_official_payroll_status on public.official_payroll(league_id, payment_status);
create index if not exists idx_official_payroll_user on public.official_payroll(user_id, payment_status);

alter table public.official_payroll enable row level security;

drop policy if exists official_payroll_read on public.official_payroll;
create policy official_payroll_read on public.official_payroll
  for select using (
    auth.uid() = user_id
    or auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = official_payroll.league_id and lm.role = 'commissioner'
    )
  );

drop policy if exists official_payroll_manage on public.official_payroll;
create policy official_payroll_manage on public.official_payroll
  for all using (
    auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = official_payroll.league_id and lm.role = 'commissioner'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Automated Payroll Generation & Rate RPCs
-- ----------------------------------------------------------------------------

-- Upsert official rate card and certification profile
create or replace function public.upsert_official_profile(
  target_league uuid,
  target_user uuid,
  official_name text,
  cert_level text,
  cert_expiry date,
  ref_fee integer,
  timekeeper_fee integer,
  active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
  v_res_id uuid;
begin
  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = target_league and lm.user_id = v_caller and lm.role = 'commissioner';

    if not coalesce(v_can_manage, false) then
      raise exception 'Permission denied: commissioner access required';
    end if;
  end if;

  insert into public.official_profiles (
    league_id,
    user_id,
    full_name,
    certification_level,
    certification_expiry,
    referee_fee_cents,
    timekeeper_fee_cents,
    is_active,
    updated_at
  )
  values (
    target_league,
    target_user,
    official_name,
    cert_level,
    cert_expiry,
    ref_fee,
    timekeeper_fee,
    active,
    now()
  )
  on conflict (league_id, user_id)
  do update set
    full_name = excluded.full_name,
    certification_level = excluded.certification_level,
    certification_expiry = excluded.certification_expiry,
    referee_fee_cents = excluded.referee_fee_cents,
    timekeeper_fee_cents = excluded.timekeeper_fee_cents,
    is_active = excluded.is_active,
    updated_at = now()
  returning id into v_res_id;

  return v_res_id;
end;
$$;

-- Generate payroll entry for a completed game
create or replace function public.generate_game_payroll_entry(
  target_game uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
  v_official record;
  v_profile record;
  v_fee integer;
  v_count integer := 0;
begin
  select g.league_id into v_league_id
  from public.games g
  where g.id = target_game;

  if not found then
    raise exception 'Game % not found', target_game;
  end if;

  -- For each official assigned to this game
  for v_official in
    select go.user_id, go.role, go.slot
    from public.game_officials go
    where go.game_id = target_game
  loop
    -- Lookup rate card from profile, or fallback to league defaults ($45 ref, $30 timekeeper)
    select * into v_profile
    from public.official_profiles op
    where op.league_id = v_league_id and op.user_id = v_official.user_id;

    if v_official.role = 'timekeeper' then
      v_fee := coalesce(v_profile.timekeeper_fee_cents, 3000);
    else
      v_fee := coalesce(v_profile.referee_fee_cents, 4500);
    end if;

    insert into public.official_payroll (
      league_id,
      game_id,
      user_id,
      role,
      slot,
      fee_cents,
      payment_status
    )
    values (
      v_league_id,
      target_game,
      v_official.user_id,
      v_official.role,
      v_official.slot,
      v_fee,
      'pending'
    )
    on conflict (game_id, user_id)
    do update set
      fee_cents = excluded.fee_cents;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Aggregate payroll summary per official for commissioner view and CSV export
create or replace function public.get_officials_payroll_summary(
  target_league uuid
)
returns table (
  user_id uuid,
  full_name text,
  certification_level text,
  total_games bigint,
  referee_games bigint,
  timekeeper_games bigint,
  total_earned_cents bigint,
  pending_cents bigint,
  paid_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    op.user_id,
    op.full_name,
    op.certification_level,
    coalesce(count(pay.id), 0)::bigint as total_games,
    coalesce(count(pay.id) filter (where pay.role = 'referee'), 0)::bigint as referee_games,
    coalesce(count(pay.id) filter (where pay.role = 'timekeeper'), 0)::bigint as timekeeper_games,
    coalesce(sum(pay.fee_cents), 0)::bigint as total_earned_cents,
    coalesce(sum(pay.fee_cents) filter (where pay.payment_status = 'pending'), 0)::bigint as pending_cents,
    coalesce(sum(pay.fee_cents) filter (where pay.payment_status = 'paid'), 0)::bigint as paid_cents
  from public.official_profiles op
  left join public.official_payroll pay on pay.league_id = op.league_id and pay.user_id = op.user_id
  where op.league_id = target_league
  group by op.user_id, op.full_name, op.certification_level
  order by total_earned_cents desc, op.full_name asc;
end;
$$;

-- Mark official payout as paid
create or replace function public.mark_official_payout(
  target_league uuid,
  target_user uuid,
  payment_ref text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
  v_updated integer;
begin
  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = target_league and lm.user_id = v_caller and lm.role = 'commissioner';

    if not coalesce(v_can_manage, false) then
      raise exception 'Permission denied: commissioner access required';
    end if;
  end if;

  update public.official_payroll set
    payment_status = 'paid',
    payout_reference = payment_ref,
    paid_at = now()
  where league_id = target_league
    and user_id = target_user
    and payment_status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Grants
-- ----------------------------------------------------------------------------
grant select on public.official_profiles to authenticated;
grant all on public.official_profiles to authenticated;

grant select on public.official_payroll to authenticated;
grant all on public.official_payroll to authenticated;

revoke execute on function public.upsert_official_profile(uuid, uuid, text, text, date, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.upsert_official_profile(uuid, uuid, text, text, date, integer, integer, boolean) to authenticated;

revoke execute on function public.generate_game_payroll_entry(uuid) from public, anon, authenticated;
grant execute on function public.generate_game_payroll_entry(uuid) to authenticated;

revoke execute on function public.get_officials_payroll_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_officials_payroll_summary(uuid) to authenticated;

revoke execute on function public.mark_official_payout(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_official_payout(uuid, uuid, text) to authenticated;

commit;
