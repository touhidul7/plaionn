begin;

-- ============================================================================
-- Migration: 202611160021_tournaments_and_cross_league.sql
-- Adds Phase 4 tournament administration, round-robin pools, advancement spots,
-- pool standings, and cross-division tournament progression.
-- ============================================================================

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 100),
  tournament_type text not null default 'pool_to_bracket' check(tournament_type in ('pool_to_bracket', 'single_elimination', 'double_elimination', 'round_robin')),
  start_date date not null,
  end_date date not null check(end_date >= start_date),
  entry_fee_cents integer not null default 0 check(entry_fee_cents >= 0),
  max_teams integer not null default 16 check(max_teams between 4 and 64),
  status text not null default 'registration_open' check(status in ('draft', 'registration_open', 'pools_announced', 'in_progress', 'completed', 'cancelled')),
  champion_entry_id uuid references public.team_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 50),
  advancement_spots integer not null default 2 check(advancement_spots >= 1),
  created_at timestamptz not null default now(),
  unique(tournament_id, name)
);

create table if not exists public.tournament_pool_entries (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.tournament_pools(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  seed_number integer not null default 1 check(seed_number >= 1),
  points integer not null default 0 check(points >= 0),
  wins integer not null default 0 check(wins >= 0),
  losses integer not null default 0 check(losses >= 0),
  ties integer not null default 0 check(ties >= 0),
  goals_for integer not null default 0 check(goals_for >= 0),
  goals_against integer not null default 0 check(goals_against >= 0),
  created_at timestamptz not null default now(),
  unique(pool_id, team_entry_id)
);

create index if not exists idx_tournaments_league on public.tournaments(league_id, status);
create index if not exists idx_pools_tournament on public.tournament_pools(tournament_id);
create index if not exists idx_pool_entries_pool on public.tournament_pool_entries(pool_id);

alter table public.tournaments enable row level security;
alter table public.tournament_pools enable row level security;
alter table public.tournament_pool_entries enable row level security;

grant select on public.tournaments, public.tournament_pools, public.tournament_pool_entries to anon, authenticated;
grant all on public.tournaments, public.tournament_pools, public.tournament_pool_entries to authenticated;

drop policy if exists tournaments_public_read on public.tournaments;
create policy tournaments_public_read on public.tournaments for select using (true);

drop policy if exists pools_public_read on public.tournament_pools;
create policy pools_public_read on public.tournament_pools for select using (true);

drop policy if exists pool_entries_public_read on public.tournament_pool_entries;
create policy pool_entries_public_read on public.tournament_pool_entries for select using (true);

drop policy if exists tournaments_comm_all on public.tournaments;
create policy tournaments_comm_all on public.tournaments for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists pools_comm_all on public.tournament_pools;
create policy pools_comm_all on public.tournament_pools for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists pool_entries_comm_all on public.tournament_pool_entries;
create policy pool_entries_comm_all on public.tournament_pool_entries for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: create_tournament
-- ============================================================================
create or replace function public.create_tournament(
  target_league uuid,
  p_name text,
  p_type text default 'pool_to_bracket',
  p_start date default current_date,
  p_end date default (current_date + interval '3 days')::date,
  p_entry_fee integer default 0,
  p_max_teams integer default 16
)
returns public.tournaments
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.tournaments;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception using errcode='22023', message='Tournament name is required';
  end if;

  insert into public.tournaments (
    league_id, name, tournament_type, start_date, end_date, entry_fee_cents, max_teams, updated_at
  )
  values (
    target_league, trim(p_name), coalesce(p_type, 'pool_to_bracket'),
    p_start, p_end, coalesce(p_entry_fee, 0), coalesce(p_max_teams, 16), now()
  )
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.create_tournament(uuid, text, text, date, date, integer, integer) to authenticated;

-- ============================================================================
-- RPC: setup_tournament_pools
-- ============================================================================
create or replace function public.setup_tournament_pools(
  target_tournament uuid,
  pool_names text[],
  p_advancement_spots integer default 2
)
returns setof public.tournament_pools
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
  p_name text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select league_id into target_league
  from public.tournaments
  where id = target_tournament;

  if target_league is null then
    raise exception using errcode='P0002', message='TOURNAMENT_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if pool_names is null or array_length(pool_names, 1) = 0 then
    raise exception using errcode='22023', message='Pool names array cannot be empty';
  end if;

  foreach p_name in array pool_names loop
    insert into public.tournament_pools (
      tournament_id, league_id, name, advancement_spots
    )
    values (
      target_tournament, target_league, trim(p_name), coalesce(p_advancement_spots, 2)
    )
    on conflict (tournament_id, name) do update
    set advancement_spots = excluded.advancement_spots;
  end loop;

  return query
  select * from public.tournament_pools
  where tournament_id = target_tournament
  order by name asc;
end;
$$;

grant execute on function public.setup_tournament_pools(uuid, text[], integer) to authenticated;

-- ============================================================================
-- RPC: assign_team_to_pool
-- ============================================================================
create or replace function public.assign_team_to_pool(
  target_pool uuid,
  target_team_entry uuid,
  p_seed integer default 1
)
returns public.tournament_pool_entries
language plpgsql
security definer
set search_path=''
as $$
declare
  target_tournament uuid;
  target_league uuid;
  rec public.tournament_pool_entries;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select tournament_id, league_id into target_tournament, target_league
  from public.tournament_pools
  where id = target_pool;

  if target_tournament is null then
    raise exception using errcode='P0002', message='POOL_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  insert into public.tournament_pool_entries (
    pool_id, tournament_id, league_id, team_entry_id, seed_number
  )
  values (
    target_pool, target_tournament, target_league, target_team_entry, coalesce(p_seed, 1)
  )
  on conflict (pool_id, team_entry_id) do update
  set seed_number = excluded.seed_number
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.assign_team_to_pool(uuid, uuid, integer) to authenticated;

-- ============================================================================
-- RPC: get_tournament_overview
-- ============================================================================
create or replace function public.get_tournament_overview(target_tournament uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  tourn_rec public.tournaments;
  pools_json jsonb;
begin
  select * into tourn_rec
  from public.tournaments
  where id = target_tournament;

  if tourn_rec.id is null then
    raise exception using errcode='P0002', message='TOURNAMENT_NOT_FOUND';
  end if;

  with pool_data as (
    select
      p.id as pool_id,
      p.name as pool_name,
      p.advancement_spots,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'entry_id', pe.id,
            'team_entry_id', pe.team_entry_id,
            'team_name', t.name,
            'seed', pe.seed_number,
            'points', pe.points,
            'wins', pe.wins,
            'losses', pe.losses,
            'ties', pe.ties,
            'gf', pe.goals_for,
            'ga', pe.goals_against
          ) order by pe.points desc, pe.wins desc, (pe.goals_for - pe.goals_against) desc
        ) filter (where pe.id is not null),
        '[]'::jsonb
      ) as standings
    from public.tournament_pools p
    left join public.tournament_pool_entries pe on pe.pool_id = p.id
    left join public.team_entries te on te.id = pe.team_entry_id
    left join public.teams t on t.id = te.team_id
    where p.tournament_id = target_tournament
    group by p.id, p.name, p.advancement_spots
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'pool_id', pool_id,
        'name', pool_name,
        'advancement_spots', advancement_spots,
        'standings', standings
      ) order by pool_name asc
    ),
    '[]'::jsonb
  )
  into pools_json
  from pool_data;

  return jsonb_build_object(
    'id', tourn_rec.id,
    'name', tourn_rec.name,
    'tournament_type', tourn_rec.tournament_type,
    'start_date', tourn_rec.start_date,
    'end_date', tourn_rec.end_date,
    'status', tourn_rec.status,
    'max_teams', tourn_rec.max_teams,
    'entry_fee_cents', tourn_rec.entry_fee_cents,
    'pools', pools_json
  );
end;
$$;

grant execute on function public.get_tournament_overview(uuid) to anon, authenticated;

commit;
