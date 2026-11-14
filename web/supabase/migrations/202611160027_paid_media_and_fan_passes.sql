begin;

-- ============================================================================
-- Migration: 202611160027_paid_media_and_fan_passes.sql
-- Adds fan pay-per-view game streaming tickets, season video passes,
-- entitlement access verification, and broadcast subscription monetization.
-- ============================================================================

create table if not exists public.stream_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  single_game_price_cents integer not null default 999 check(single_game_price_cents >= 0),
  season_pass_price_cents integer not null default 4999 check(season_pass_price_cents >= 0),
  playoff_pass_price_cents integer not null default 2999 check(playoff_pass_price_cents >= 0),
  is_paywall_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id)
);

create table if not exists public.fan_access_passes (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pass_type text not null check(pass_type in ('season_stream_pass', 'single_game_ticket', 'playoff_package', 'team_family_pass')),
  game_id uuid references public.games(id) on delete cascade,
  team_entry_id uuid references public.team_entries(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete cascade,
  amount_paid_cents integer not null default 0 check(amount_paid_cents >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fan_passes_user on public.fan_access_passes(user_id, expires_at);
create index if not exists idx_fan_passes_game on public.fan_access_passes(game_id, user_id);

alter table public.stream_pricing_tiers enable row level security;
alter table public.fan_access_passes enable row level security;

grant select on public.stream_pricing_tiers, public.fan_access_passes to anon, authenticated;
grant all on public.stream_pricing_tiers, public.fan_access_passes to authenticated;

drop policy if exists pricing_public_read on public.stream_pricing_tiers;
create policy pricing_public_read on public.stream_pricing_tiers for select using (true);

drop policy if exists pricing_comm_manage on public.stream_pricing_tiers;
create policy pricing_comm_manage on public.stream_pricing_tiers for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists passes_user_read on public.fan_access_passes;
create policy passes_user_read on public.fan_access_passes for select using (
  user_id = auth.uid() or public.is_league_commissioner(league_id)
);

drop policy if exists passes_user_insert on public.fan_access_passes;
create policy passes_user_insert on public.fan_access_passes for insert with check (
  user_id = auth.uid() or public.is_league_commissioner(league_id)
);

-- ============================================================================
-- RPC: verify_fan_stream_access
-- ============================================================================
create or replace function public.verify_fan_stream_access(
  target_game uuid,
  target_user uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_league uuid;
  pricing_rec public.stream_pricing_tiers;
  has_pass boolean;
begin
  select league_id into target_league
  from public.games
  where id = target_game;

  if target_league is null then
    return false;
  end if;

  -- 1. Check if paywall is enabled
  select * into pricing_rec
  from public.stream_pricing_tiers
  where league_id = target_league;

  if pricing_rec.id is null or not pricing_rec.is_paywall_active then
    -- Free streaming enabled
    return true;
  end if;

  if target_user is null then
    return false;
  end if;

  -- 2. Commissioners and league staff have complimentary access
  if exists (
    select 1 from public.league_memberships
    where league_id = target_league and user_id = target_user
      and role in ('commissioner', 'media', 'referee', 'timekeeper')
  ) then
    return true;
  end if;

  -- 3. Check for valid active fan pass
  select exists (
    select 1 from public.fan_access_passes
    where user_id = target_user
      and league_id = target_league
      and expires_at > now()
      and (
        pass_type in ('season_stream_pass', 'playoff_package') or
        (pass_type = 'single_game_ticket' and game_id = target_game)
      )
  ) into has_pass;

  return has_pass;
end;
$$;

grant execute on function public.verify_fan_stream_access(uuid, uuid) to anon, authenticated;

-- ============================================================================
-- RPC: purchase_fan_pass
-- ============================================================================
create or replace function public.purchase_fan_pass(
  target_league uuid,
  p_pass_type text,
  p_game_id uuid default null,
  p_season_id uuid default null
)
returns public.fan_access_passes
language plpgsql
security definer
set search_path=''
as $$
declare
  pricing public.stream_pricing_tiers;
  price_cents integer := 0;
  exp_time timestamptz;
  rec public.fan_access_passes;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into pricing
  from public.stream_pricing_tiers
  where league_id = target_league;

  if p_pass_type = 'single_game_ticket' then
    if p_game_id is null then
      raise exception using errcode='22023', message='Game ID required for single ticket';
    end if;
    price_cents := coalesce(pricing.single_game_price_cents, 999);
    exp_time := now() + interval '24 hours';
  elsif p_pass_type = 'playoff_package' then
    price_cents := coalesce(pricing.playoff_pass_price_cents, 2999);
    exp_time := now() + interval '45 days';
  else
    p_pass_type := 'season_stream_pass';
    price_cents := coalesce(pricing.season_pass_price_cents, 4999);
    exp_time := now() + interval '180 days';
  end if;

  insert into public.fan_access_passes (
    league_id, user_id, pass_type, game_id, season_id, amount_paid_cents, expires_at
  )
  values (
    target_league, auth.uid(), p_pass_type, p_game_id, p_season_id, price_cents, exp_time
  )
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.purchase_fan_pass(uuid, text, uuid, uuid) to authenticated;

-- ============================================================================
-- RPC: configure_stream_paywall
-- ============================================================================
create or replace function public.configure_stream_paywall(
  target_league uuid,
  p_active boolean,
  p_single_cents integer default 999,
  p_season_cents integer default 4999
)
returns public.stream_pricing_tiers
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.stream_pricing_tiers;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  insert into public.stream_pricing_tiers (
    league_id, is_paywall_active, single_game_price_cents, season_pass_price_cents, updated_at
  )
  values (
    target_league, p_active, coalesce(p_single_cents, 999), coalesce(p_season_cents, 4999), now()
  )
  on conflict (league_id) do update
  set is_paywall_active = excluded.is_paywall_active,
      single_game_price_cents = excluded.single_game_price_cents,
      season_pass_price_cents = excluded.season_pass_price_cents,
      updated_at = now()
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.configure_stream_paywall(uuid, boolean, integer, integer) to authenticated;

commit;
