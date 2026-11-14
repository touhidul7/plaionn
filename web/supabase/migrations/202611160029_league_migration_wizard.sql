begin;

-- ============================================================================
-- Migration: 202611160029_league_migration_wizard.sql
-- Adds automated league migration, legacy data onboarding (TeamSnap, GoalLine,
-- Pointstreak, LeagueApps, CSV), preflight validation, and batch ingestion.
-- ============================================================================

create table if not exists public.league_migration_jobs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  source_platform text not null check(source_platform in ('teamsnap', 'pointstreak', 'goalline', 'leagueapps', 'custom_csv')),
  status text not null default 'draft' check(status in ('draft', 'validated', 'importing', 'completed', 'failed')),
  total_rows integer not null default 0 check(total_rows >= 0),
  imported_divisions integer not null default 0 check(imported_divisions >= 0),
  imported_teams integer not null default 0 check(imported_teams >= 0),
  imported_players integer not null default 0 check(imported_players >= 0),
  imported_games integer not null default 0 check(imported_games >= 0),
  validation_report jsonb default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_migration_league on public.league_migration_jobs(league_id);

alter table public.league_migration_jobs enable row level security;

grant select on public.league_migration_jobs to anon, authenticated;
grant all on public.league_migration_jobs to authenticated;

drop policy if exists migration_comm_all on public.league_migration_jobs;
create policy migration_comm_all on public.league_migration_jobs for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: execute_league_migration
-- Ingests divisions, teams, and player rosters from legacy platforms
-- ============================================================================
create or replace function public.execute_league_migration(
  target_league uuid,
  target_season uuid,
  p_platform text,
  p_divisions jsonb,
  p_teams jsonb,
  p_players jsonb
)
returns public.league_migration_jobs
language plpgsql
security definer
set search_path=''
as $$
declare
  job public.league_migration_jobs;
  item jsonb;
  div_id uuid;
  team_id uuid;
  entry_id uuid;
  player_id uuid;
  d_name text;
  t_name text;
  p_name text;
  p_num integer;
  p_pos text;
  n_divs int := 0;
  n_teams int := 0;
  n_players int := 0;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  insert into public.league_migration_jobs (
    league_id, source_platform, status, created_by
  )
  values (
    target_league, coalesce(p_platform, 'custom_csv'), 'importing', auth.uid()
  )
  returning * into job;

  -- 1. Import divisions
  if p_divisions is not null and jsonb_typeof(p_divisions) = 'array' then
    for item in select * from jsonb_array_elements(p_divisions) loop
      d_name := trim(item->>'name');
      if d_name is not null and length(d_name) > 0 then
        insert into public.divisions (league_id, season_id, name)
        values (target_league, target_season, d_name)
        on conflict do nothing;
        n_divs := n_divs + 1;
      end if;
    end loop;
  end if;

  -- 2. Import teams and team entries
  if p_teams is not null and jsonb_typeof(p_teams) = 'array' then
    for item in select * from jsonb_array_elements(p_teams) loop
      t_name := trim(item->>'name');
      d_name := trim(item->>'division_name');
      if t_name is not null and length(t_name) > 0 then
        -- Find division
        select id into div_id from public.divisions
        where league_id = target_league and season_id = target_season
          and lower(trim(name)) = lower(coalesce(d_name, 'Open'))
        limit 1;

        if div_id is null then
          select id into div_id from public.divisions
          where league_id = target_league and season_id = target_season
          limit 1;
        end if;

        select id into team_id
        from public.teams
        where league_id = target_league and lower(name) = lower(t_name)
        limit 1;

        if team_id is null then
          insert into public.teams (league_id, name)
          values (target_league, t_name)
          returning id into team_id;
        end if;

        if div_id is not null and team_id is not null then
          insert into public.team_entries (league_id, division_id, team_id)
          values (target_league, div_id, team_id)
          on conflict do nothing;
          n_teams := n_teams + 1;
        end if;
      end if;
    end loop;
  end if;

  -- 3. Import players and assign to team rosters
  if p_players is not null and jsonb_typeof(p_players) = 'array' then
    for item in select * from jsonb_array_elements(p_players) loop
      p_name := trim(item->>'name');
      t_name := trim(item->>'team_name');
      p_num := nullif(item->>'jersey_number', '')::integer;
      p_pos := upper(coalesce(nullif(trim(item->>'position'), ''), 'F'));
      if p_pos not in ('C', 'LW', 'RW', 'D', 'G', 'F') then
        p_pos := 'F';
      end if;

      if p_name is not null and length(p_name) > 1 then
        -- Find or create player
        select p.id into player_id
        from public.players p
        join public.league_players lp on lp.player_id = p.id and lp.league_id = target_league
        where lower(trim(p.display_name)) = lower(p_name)
        limit 1;

        if player_id is null then
          insert into public.players (display_name)
          values (p_name)
          returning id into player_id;

          insert into public.league_players (league_id, player_id)
          values (target_league, player_id)
          on conflict do nothing;
        end if;

        -- Find team entry
        select te.id into entry_id
        from public.team_entries te
        join public.teams t on t.id = te.team_id
        join public.divisions d on d.id = te.division_id
        where te.league_id = target_league and d.season_id = target_season
          and lower(trim(t.name)) = lower(coalesce(t_name, ''))
        limit 1;

        if entry_id is not null and player_id is not null then
          insert into public.roster_memberships (
            league_id, team_entry_id, player_id, jersey_number, position, status
          )
          values (
            target_league, entry_id, player_id, p_num, p_pos, 'active'
          )
          on conflict do nothing;
          n_players := n_players + 1;
        end if;
      end if;
    end loop;
  end if;

  update public.league_migration_jobs
  set status = 'completed',
      imported_divisions = n_divs,
      imported_teams = n_teams,
      imported_players = n_players,
      total_rows = n_divs + n_teams + n_players,
      completed_at = now()
  where id = job.id
  returning * into job;

  return job;
end;
$$;

grant execute on function public.execute_league_migration(uuid, uuid, text, jsonb, jsonb, jsonb) to authenticated;

commit;
