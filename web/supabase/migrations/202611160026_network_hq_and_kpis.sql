begin;

-- ============================================================================
-- Migration: 202611160026_network_hq_and_kpis.sql
-- Adds multi-league network management, franchise ownership grouping,
-- and executive KPI rollups across all leagues, teams, and arenas.
-- ============================================================================

create table if not exists public.network_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 100),
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.network_organization_leagues (
  organization_id uuid not null references public.network_organizations(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(organization_id, league_id)
);

alter table public.network_organizations enable row level security;
alter table public.network_organization_leagues enable row level security;

grant select on public.network_organizations, public.network_organization_leagues to anon, authenticated;
grant all on public.network_organizations, public.network_organization_leagues to authenticated;

drop policy if exists net_org_owner on public.network_organizations;
create policy net_org_owner on public.network_organizations for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists net_leagues_owner on public.network_organization_leagues;
create policy net_leagues_owner on public.network_organization_leagues for all to authenticated
  using (
    exists (
      select 1 from public.network_organizations no
      where no.id = network_organization_leagues.organization_id and no.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.network_organizations no
      where no.id = network_organization_leagues.organization_id and no.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- RPC: create_network_organization
-- ============================================================================
create or replace function public.create_network_organization(p_name text)
returns public.network_organizations
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.network_organizations;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception using errcode='22023', message='Organization name is required';
  end if;

  insert into public.network_organizations (name, owner_user_id)
  values (trim(p_name), auth.uid())
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.create_network_organization(text) to authenticated;

-- ============================================================================
-- RPC: add_league_to_network
-- ============================================================================
create or replace function public.add_league_to_network(
  target_org_id uuid,
  target_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  -- Ensure caller owns the network org and is commissioner of the league
  perform 1 from public.network_organizations
  where id = target_org_id and owner_user_id = auth.uid();
  if not found then
    raise exception using errcode='42501', message='Network ownership required';
  end if;

  if not public.is_league_commissioner(target_league_id) then
    raise exception using errcode='42501', message='Commissioner access to league required';
  end if;

  insert into public.network_organization_leagues (organization_id, league_id)
  values (target_org_id, target_league_id)
  on conflict (organization_id, league_id) do nothing;

  return true;
end;
$$;

grant execute on function public.add_league_to_network(uuid, uuid) to authenticated;

-- ============================================================================
-- RPC: get_network_executive_kpis
-- ============================================================================
create or replace function public.get_network_executive_kpis(target_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  total_leagues bigint;
  total_seasons bigint;
  total_teams bigint;
  total_players bigint;
  total_games bigint;
  completed_games bigint;
  completion_pct numeric(5,2);
  leagues_list jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  perform 1 from public.network_organizations
  where id = target_org_id and owner_user_id = auth.uid();
  if not found then
    raise exception using errcode='42501', message='Network ownership required';
  end if;

  with network_leagues as (
    select nol.league_id, l.name as league_name
    from public.network_organization_leagues nol
    join public.leagues l on l.id = nol.league_id
    where nol.organization_id = target_org_id
  )
  select
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'league_id', nl.league_id,
          'league_name', nl.league_name,
          'team_count', (select count(*) from public.team_entries te where te.league_id = nl.league_id),
          'player_count', (select count(*) from public.league_players lp where lp.league_id = nl.league_id),
          'game_count', (select count(*) from public.games g where g.league_id = nl.league_id)
        )
      ),
      '[]'::jsonb
    )
  into total_leagues, leagues_list
  from network_leagues nl;

  select count(*) into total_seasons
  from public.seasons s
  join public.network_organization_leagues nol on nol.league_id = s.league_id
  where nol.organization_id = target_org_id;

  select count(*) into total_teams
  from public.team_entries te
  join public.network_organization_leagues nol on nol.league_id = te.league_id
  where nol.organization_id = target_org_id;

  select count(distinct lp.player_id) into total_players
  from public.league_players lp
  join public.network_organization_leagues nol on nol.league_id = lp.league_id
  where nol.organization_id = target_org_id;

  select
    count(*),
    count(*) filter (where gr.status = 'approved')
  into total_games, completed_games
  from public.games g
  join public.network_organization_leagues nol on nol.league_id = g.league_id
  left join public.game_results gr on gr.game_id = g.id
  where nol.organization_id = target_org_id;

  if total_games > 0 then
    completion_pct := round(((completed_games::numeric / total_games::numeric) * 100.0), 2);
  else
    completion_pct := 0.00;
  end if;

  return jsonb_build_object(
    'organization_id', target_org_id,
    'total_leagues', total_leagues,
    'total_seasons', total_seasons,
    'total_teams', total_teams,
    'total_unique_players', total_players,
    'total_games', total_games,
    'completed_games', completed_games,
    'game_completion_pct', completion_pct,
    'leagues', leagues_list
  );
end;
$$;

grant execute on function public.get_network_executive_kpis(uuid) to authenticated;

commit;
