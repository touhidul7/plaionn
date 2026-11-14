begin;

-- ============================================================================
-- Migration: 202611160018_merchandise_and_jersey_orders.sql
-- Adds team jersey customization, product catalog, team orders with sizes,
-- custom nameplates, number assignments, and commissioner production tracking.
-- ============================================================================

create table if not exists public.team_jersey_customizations (
  id uuid primary key default gen_random_uuid(),
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  primary_color text not null default '#000000',
  secondary_color text not null default '#FFFFFF',
  accent_color text,
  crest_logo_url text,
  shoulder_patch_url text,
  jersey_cut text not null default 'traditional' check(jersey_cut in ('traditional', 'pro_fit', 'retro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_entry_id)
);

create table if not exists public.merchandise_products (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  sku text not null,
  name text not null check(length(trim(name)) between 2 and 100),
  item_type text not null check(item_type in ('jersey', 'socks', 'pant_shell', 'apparel', 'gear')),
  description text,
  unit_price_cents integer not null default 0 check(unit_price_cents >= 0),
  allowed_sizes text[] not null default array['YTH-S','YTH-M','YTH-L','S','M','L','XL','XXL','Goalie Cut'],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(league_id, sku)
);

create table if not exists public.team_merchandise_orders (
  id uuid primary key default gen_random_uuid(),
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  order_status text not null default 'draft' check(order_status in ('draft', 'submitted', 'in_production', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'pending' check(payment_status in ('pending', 'partial', 'paid', 'waived')),
  total_price_cents integer not null default 0 check(total_price_cents >= 0),
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchandise_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.team_merchandise_orders(id) on delete cascade,
  product_id uuid not null references public.merchandise_products(id) on delete restrict,
  player_id uuid references public.players(id) on delete set null,
  recipient_name text not null check(length(trim(recipient_name)) between 1 and 100),
  size text not null,
  jersey_number integer check(jersey_number is null or (jersey_number between 0 and 99)),
  custom_nameplate text check(custom_nameplate is null or length(trim(custom_nameplate)) <= 30),
  color_variant text,
  quantity integer not null default 1 check(quantity > 0),
  unit_price_cents integer not null check(unit_price_cents >= 0),
  item_subtotal_cents integer not null check(item_subtotal_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_jersey_orders_team on public.team_merchandise_orders(team_entry_id);
create index if not exists idx_jersey_items_order on public.merchandise_order_items(order_id);

alter table public.team_jersey_customizations enable row level security;
alter table public.merchandise_products enable row level security;
alter table public.team_merchandise_orders enable row level security;
alter table public.merchandise_order_items enable row level security;

grant select on public.team_jersey_customizations, public.merchandise_products,
  public.team_merchandise_orders, public.merchandise_order_items to anon, authenticated;
grant all on public.team_jersey_customizations, public.merchandise_products,
  public.team_merchandise_orders, public.merchandise_order_items to authenticated;

drop policy if exists jersey_custom_read on public.team_jersey_customizations;
create policy jersey_custom_read on public.team_jersey_customizations for select using (true);

drop policy if exists jersey_custom_manage on public.team_jersey_customizations;
create policy jersey_custom_manage on public.team_jersey_customizations for all to authenticated
  using (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = team_jersey_customizations.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
    )
  )
  with check (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = team_jersey_customizations.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
    )
  );

drop policy if exists merch_products_read on public.merchandise_products;
create policy merch_products_read on public.merchandise_products for select using (true);

drop policy if exists merch_products_comm_all on public.merchandise_products;
create policy merch_products_comm_all on public.merchandise_products for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists merch_orders_read on public.team_merchandise_orders;
create policy merch_orders_read on public.team_merchandise_orders for select using (
  public.is_league_commissioner(league_id) or
  exists (
    select 1 from public.league_memberships lm
    where lm.league_id = team_merchandise_orders.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
  )
);

drop policy if exists merch_orders_manage on public.team_merchandise_orders;
create policy merch_orders_manage on public.team_merchandise_orders for all to authenticated
  using (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = team_merchandise_orders.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
    )
  )
  with check (
    public.is_league_commissioner(league_id) or
    exists (
      select 1 from public.league_memberships lm
      where lm.league_id = team_merchandise_orders.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
    )
  );

drop policy if exists merch_items_read on public.merchandise_order_items;
create policy merch_items_read on public.merchandise_order_items for select using (
  exists (
    select 1 from public.team_merchandise_orders o
    where o.id = merchandise_order_items.order_id and (
      public.is_league_commissioner(o.league_id) or
      exists (
        select 1 from public.league_memberships lm
        where lm.league_id = o.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
      )
    )
  )
);

drop policy if exists merch_items_manage on public.merchandise_order_items;
create policy merch_items_manage on public.merchandise_order_items for all to authenticated
  using (
    exists (
      select 1 from public.team_merchandise_orders o
      where o.id = merchandise_order_items.order_id and (
        public.is_league_commissioner(o.league_id) or
        exists (
          select 1 from public.league_memberships lm
          where lm.league_id = o.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
        )
      )
    )
  )
  with check (
    exists (
      select 1 from public.team_merchandise_orders o
      where o.id = merchandise_order_items.order_id and (
        public.is_league_commissioner(o.league_id) or
        exists (
          select 1 from public.league_memberships lm
          where lm.league_id = o.league_id and lm.user_id = auth.uid() and lm.role in ('captain', 'commissioner')
        )
      )
    )
  );

-- ============================================================================
-- RPC: save_team_jersey_style
-- ============================================================================
create or replace function public.save_team_jersey_style(
  target_entry uuid,
  p_primary_color text,
  p_secondary_color text,
  p_accent_color text default null,
  p_jersey_cut text default 'traditional',
  p_crest_logo_url text default null
)
returns public.team_jersey_customizations
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
  is_captain boolean;
  res public.team_jersey_customizations;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select league_id into target_league
  from public.team_entries
  where id = target_entry;

  if target_league is null then
    raise exception using errcode='P0002', message='TEAM_ENTRY_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.league_memberships
    where league_id = target_league and user_id = auth.uid() and role in ('captain', 'commissioner')
  ) into is_captain;

  if not (is_captain or public.is_league_commissioner(target_league)) then
    raise exception using errcode='42501', message='Captain or commissioner authorization required';
  end if;

  insert into public.team_jersey_customizations (
    team_entry_id, league_id, primary_color, secondary_color, accent_color, crest_logo_url, jersey_cut, updated_at
  )
  values (
    target_entry, target_league, coalesce(p_primary_color, '#000000'), coalesce(p_secondary_color, '#FFFFFF'),
    p_accent_color, p_crest_logo_url, coalesce(p_jersey_cut, 'traditional'), now()
  )
  on conflict (team_entry_id) do update
  set primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      accent_color = excluded.accent_color,
      crest_logo_url = coalesce(excluded.crest_logo_url, public.team_jersey_customizations.crest_logo_url),
      jersey_cut = excluded.jersey_cut,
      updated_at = now()
  returning * into res;

  return res;
end;
$$;

grant execute on function public.save_team_jersey_style(uuid, text, text, text, text, text) to authenticated;

-- ============================================================================
-- RPC: create_or_update_team_order
-- ============================================================================
create or replace function public.create_or_update_team_order(
  target_entry uuid,
  items jsonb,
  order_notes text default null
)
returns public.team_merchandise_orders
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
  is_captain boolean;
  target_order public.team_merchandise_orders;
  item jsonb;
  prod_rec public.merchandise_products;
  item_qty int;
  item_subtotal int;
  running_total int := 0;
  p_pid uuid;
  p_recip text;
  p_size text;
  p_num int;
  p_plate text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select league_id into target_league
  from public.team_entries
  where id = target_entry;

  if target_league is null then
    raise exception using errcode='P0002', message='TEAM_ENTRY_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.league_memberships
    where league_id = target_league and user_id = auth.uid() and role in ('captain', 'commissioner')
  ) into is_captain;

  if not (is_captain or public.is_league_commissioner(target_league)) then
    raise exception using errcode='42501', message='Captain or commissioner authorization required';
  end if;

  -- Find or create open draft order
  select * into target_order
  from public.team_merchandise_orders
  where team_entry_id = target_entry and order_status = 'draft'
  limit 1
  for update;

  if target_order.id is null then
    insert into public.team_merchandise_orders (
      team_entry_id, league_id, order_status, notes, submitted_by
    )
    values (
      target_entry, target_league, 'draft', order_notes, auth.uid()
    )
    returning * into target_order;
  else
    update public.team_merchandise_orders
    set notes = coalesce(order_notes, notes), updated_at = now()
    where id = target_order.id
    returning * into target_order;

    delete from public.merchandise_order_items where order_id = target_order.id;
  end if;

  if items is not null and jsonb_typeof(items) = 'array' then
    for item in select * from jsonb_array_elements(items) loop
      p_pid := (item->>'product_id')::uuid;
      select * into prod_rec
      from public.merchandise_products
      where id = p_pid and league_id = target_league;

      if prod_rec.id is null then
        raise exception using errcode='P0002', message='Product not found in league catalog';
      end if;

      item_qty := coalesce((item->>'quantity')::integer, 1);
      if item_qty <= 0 then
        item_qty := 1;
      end if;

      p_recip := coalesce(nullif(trim(item->>'recipient_name'), ''), 'Team Member');
      p_size := coalesce(nullif(trim(item->>'size'), ''), 'L');
      if item ? 'jersey_number' and item->>'jersey_number' is not null and item->>'jersey_number' <> '' then
        p_num := (item->>'jersey_number')::integer;
      else
        p_num := null;
      end if;
      p_plate := nullif(trim(item->>'custom_nameplate'), '');

      item_subtotal := prod_rec.unit_price_cents * item_qty;
      running_total := running_total + item_subtotal;

      insert into public.merchandise_order_items (
        order_id,
        product_id,
        player_id,
        recipient_name,
        size,
        jersey_number,
        custom_nameplate,
        color_variant,
        quantity,
        unit_price_cents,
        item_subtotal_cents
      )
      values (
        target_order.id,
        prod_rec.id,
        nullif(item->>'player_id', '')::uuid,
        p_recip,
        p_size,
        p_num,
        p_plate,
        nullif(trim(item->>'color_variant'), ''),
        item_qty,
        prod_rec.unit_price_cents,
        item_subtotal
      );
    end loop;
  end if;

  update public.team_merchandise_orders
  set total_price_cents = running_total,
      updated_at = now()
  where id = target_order.id
  returning * into target_order;

  return target_order;
end;
$$;

grant execute on function public.create_or_update_team_order(uuid, jsonb, text) to authenticated;

-- ============================================================================
-- RPC: submit_team_merchandise_order
-- ============================================================================
create or replace function public.submit_team_merchandise_order(target_order_id uuid)
returns public.team_merchandise_orders
language plpgsql
security definer
set search_path=''
as $$
declare
  target_rec public.team_merchandise_orders;
  is_captain boolean;
  item_count int;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into target_rec
  from public.team_merchandise_orders
  where id = target_order_id
  for update;

  if target_rec.id is null then
    raise exception using errcode='P0002', message='ORDER_NOT_FOUND';
  end if;

  select exists (
    select 1 from public.league_memberships
    where league_id = target_rec.league_id and user_id = auth.uid() and role in ('captain', 'commissioner')
  ) into is_captain;

  if not (is_captain or public.is_league_commissioner(target_rec.league_id)) then
    raise exception using errcode='42501', message='Authorization required';
  end if;

  select count(*) into item_count
  from public.merchandise_order_items
  where order_id = target_rec.id;

  if item_count = 0 then
    raise exception using errcode='22023', message='Cannot submit an empty order';
  end if;

  update public.team_merchandise_orders
  set order_status = 'submitted',
      submitted_at = now(),
      submitted_by = auth.uid(),
      updated_at = now()
  where id = target_rec.id
  returning * into target_rec;

  return target_rec;
end;
$$;

grant execute on function public.submit_team_merchandise_order(uuid) to authenticated;

-- ============================================================================
-- RPC: update_merchandise_order_status
-- ============================================================================
create or replace function public.update_merchandise_order_status(
  target_order_id uuid,
  new_order_status text,
  new_payment_status text default null
)
returns public.team_merchandise_orders
language plpgsql
security definer
set search_path=''
as $$
declare
  target_rec public.team_merchandise_orders;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into target_rec
  from public.team_merchandise_orders
  where id = target_order_id
  for update;

  if target_rec.id is null then
    raise exception using errcode='P0002', message='ORDER_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(target_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  update public.team_merchandise_orders
  set order_status = coalesce(new_order_status, order_status),
      payment_status = coalesce(new_payment_status, payment_status),
      updated_at = now()
  where id = target_rec.id
  returning * into target_rec;

  return target_rec;
end;
$$;

grant execute on function public.update_merchandise_order_status(uuid, text, text) to authenticated;

commit;
