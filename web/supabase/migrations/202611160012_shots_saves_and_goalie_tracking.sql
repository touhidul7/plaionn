begin;

-- ============================================================================
-- Migration: 202611160012_shots_saves_and_goalie_tracking.sql
-- Adds detailed period-by-period shots on goal tracking, goalie stints,
-- saves, save percentage calculations, and live goalie boxscores.
-- ============================================================================

create table public.game_period_shots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  game_id uuid not null references public.games(id),
  team_entry_id uuid not null references public.team_entries(id),
  period integer not null check(period between 1 and 10),
  shots integer not null default 0 check(shots >= 0),
  recorded_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(game_id, team_entry_id, period)
);

create table public.game_goalie_stints (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  game_id uuid not null references public.games(id),
  team_entry_id uuid not null references public.team_entries(id),
  player_id uuid not null references public.players(id),
  period_start integer not null default 1 check(period_start between 1 and 10),
  clock_start_seconds integer not null default 1200 check(clock_start_seconds >= 0),
  period_end integer check(period_end between 1 and 10),
  clock_end_seconds integer check(clock_end_seconds >= 0),
  is_empty_net boolean not null default false,
  shots_against integer not null default 0 check(shots_against >= 0),
  goals_against integer not null default 0 check(goals_against >= 0),
  decision text check(decision in ('W', 'L', 'OTL', 'ND', null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_period_shots enable row level security;
alter table public.game_goalie_stints enable row level security;

revoke all on public.game_period_shots, public.game_goalie_stints from anon, authenticated;
grant select on public.game_period_shots, public.game_goalie_stints to anon, authenticated;
grant insert, update, delete on public.game_period_shots, public.game_goalie_stints to authenticated;

-- Policies
create policy period_shots_read on public.game_period_shots for select to anon, authenticated using(true);
create policy period_shots_manage on public.game_period_shots for all to authenticated
  using(
    public.is_league_commissioner(league_id)
    or exists(select 1 from public.game_officials go where go.game_id = game_period_shots.game_id and go.user_id = auth.uid())
  )
  with check(
    public.is_league_commissioner(league_id)
    or exists(select 1 from public.game_officials go where go.game_id = game_period_shots.game_id and go.user_id = auth.uid())
  );

create policy goalie_stints_read on public.game_goalie_stints for select to anon, authenticated using(true);
create policy goalie_stints_manage on public.game_goalie_stints for all to authenticated
  using(
    public.is_league_commissioner(league_id)
    or exists(select 1 from public.game_officials go where go.game_id = game_goalie_stints.game_id and go.user_id = auth.uid())
  )
  with check(
    public.is_league_commissioner(league_id)
    or exists(select 1 from public.game_officials go where go.game_id = game_goalie_stints.game_id and go.user_id = auth.uid())
  );

-- RPC: record_period_shots
create or replace function public.record_period_shots(
  target_game uuid,
  target_team_entry uuid,
  target_period integer,
  shot_count integer
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  g_rec public.games;
  row_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into g_rec from public.games where id = target_game;
  if g_rec.id is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  if not (
    public.is_league_commissioner(g_rec.league_id)
    or exists(select 1 from public.game_officials go where go.game_id = target_game and go.user_id = auth.uid())
  ) then
    raise exception using errcode='42501', message='Only assigned officials or commissioners can record shots';
  end if;

  if target_team_entry not in (g_rec.home_entry_id, g_rec.away_entry_id) then
    raise exception using errcode='22023', message='Team entry is not participating in this game';
  end if;

  if target_period < 1 or target_period > 10 then
    raise exception using errcode='22023', message='Invalid period';
  end if;

  if shot_count < 0 or shot_count > 150 then
    raise exception using errcode='22023', message='Shot count must be between 0 and 150';
  end if;

  insert into public.game_period_shots (
    league_id,
    game_id,
    team_entry_id,
    period,
    shots,
    recorded_by,
    updated_at
  ) values (
    g_rec.league_id,
    target_game,
    target_team_entry,
    target_period,
    shot_count,
    auth.uid(),
    now()
  )
  on conflict (game_id, team_entry_id, period)
  do update set
    shots = excluded.shots,
    recorded_by = auth.uid(),
    updated_at = now()
  returning id into row_id;

  return row_id;
end;
$$;

-- RPC: record_goalie_stint
create or replace function public.record_goalie_stint(
  target_game uuid,
  target_team_entry uuid,
  target_goalie uuid,
  p_start integer default 1,
  c_start integer default 1200,
  p_end integer default null,
  c_end integer default null,
  empty_net boolean default false,
  shots_faced integer default 0,
  goals_allowed integer default 0,
  goalie_decision text default 'ND'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  g_rec public.games;
  stint_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into g_rec from public.games where id = target_game;
  if g_rec.id is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  if not (
    public.is_league_commissioner(g_rec.league_id)
    or exists(select 1 from public.game_officials go where go.game_id = target_game and go.user_id = auth.uid())
  ) then
    raise exception using errcode='42501', message='Only assigned officials or commissioners can record goalie stints';
  end if;

  if target_team_entry not in (g_rec.home_entry_id, g_rec.away_entry_id) then
    raise exception using errcode='22023', message='Team entry is not participating in this game';
  end if;

  if shots_faced < 0 or goals_allowed < 0 or goals_allowed > shots_faced then
    raise exception using errcode='22023', message='Goals allowed cannot exceed shots faced';
  end if;

  insert into public.game_goalie_stints (
    league_id,
    game_id,
    team_entry_id,
    player_id,
    period_start,
    clock_start_seconds,
    period_end,
    clock_end_seconds,
    is_empty_net,
    shots_against,
    goals_against,
    decision,
    updated_at
  ) values (
    g_rec.league_id,
    target_game,
    target_team_entry,
    target_goalie,
    greatest(1, coalesce(p_start, 1)),
    greatest(0, coalesce(c_start, 1200)),
    p_end,
    c_end,
    coalesce(empty_net, false),
    greatest(0, coalesce(shots_faced, 0)),
    greatest(0, coalesce(goals_allowed, 0)),
    goalie_decision,
    now()
  )
  returning id into stint_id;

  return stint_id;
end;
$$;

-- RPC: get_game_shots_summary
create or replace function public.get_game_shots_summary(target_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  g_rec public.games;
  home_name text;
  away_name text;
  shots_data jsonb;
  goalies_data jsonb;
begin
  select * into g_rec from public.games where id = target_game;
  if g_rec.id is null then
    return '{}'::jsonb;
  end if;

  select t.name into home_name
  from public.team_entries te
  join public.teams t on t.id = te.team_id
  where te.id = g_rec.home_entry_id;

  select t.name into away_name
  from public.team_entries te
  join public.teams t on t.id = te.team_id
  where te.id = g_rec.away_entry_id;

  -- Period shots aggregation
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'team_entry_id', team_shots.team_entry_id,
        'team_name', team_shots.team_name,
        'p1', team_shots.p1,
        'p2', team_shots.p2,
        'p3', team_shots.p3,
        'ot', team_shots.ot,
        'total', team_shots.total
      )
    ),
    '[]'::jsonb
  ) into shots_data
  from (
    select
      teams.te_id as team_entry_id,
      teams.t_name as team_name,
      coalesce(sum(case when gps.period = 1 then gps.shots end), 0) as p1,
      coalesce(sum(case when gps.period = 2 then gps.shots end), 0) as p2,
      coalesce(sum(case when gps.period = 3 then gps.shots end), 0) as p3,
      coalesce(sum(case when gps.period > 3 then gps.shots end), 0) as ot,
      coalesce(sum(gps.shots), 0) as total
    from (
      select g_rec.home_entry_id as te_id, home_name as t_name
      union all
      select g_rec.away_entry_id as te_id, away_name as t_name
    ) teams
    left join public.game_period_shots gps on gps.game_id = target_game and gps.team_entry_id = teams.te_id
    group by teams.te_id, teams.t_name
  ) team_shots;

  -- Goalie stints aggregation
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stint_id', gs.id,
        'team_entry_id', gs.team_entry_id,
        'team_name', case when gs.team_entry_id = g_rec.home_entry_id then home_name else away_name end,
        'player_id', gs.player_id,
        'player_name', p.display_name,
        'shots_against', gs.shots_against,
        'goals_against', gs.goals_against,
        'saves', gs.shots_against - gs.goals_against,
        'save_percentage', case
          when gs.shots_against > 0 then round(((gs.shots_against - gs.goals_against)::numeric / gs.shots_against::numeric) * 100, 1)
          else 0.0
        end,
        'is_empty_net', gs.is_empty_net,
        'decision', gs.decision
      )
      order by gs.created_at
    ),
    '[]'::jsonb
  ) into goalies_data
  from public.game_goalie_stints gs
  join public.players p on p.id = gs.player_id
  where gs.game_id = target_game;

  return jsonb_build_object(
    'game_id', target_game,
    'home_entry_id', g_rec.home_entry_id,
    'away_entry_id', g_rec.away_entry_id,
    'home_name', home_name,
    'away_name', away_name,
    'period_shots', shots_data,
    'goalies', goalies_data
  );
end;
$$;

revoke all on function public.record_period_shots(uuid, uuid, integer, integer),
  public.record_goalie_stint(uuid, uuid, uuid, integer, integer, integer, integer, boolean, integer, integer, text),
  public.get_game_shots_summary(uuid) from public, anon, authenticated;

grant execute on function public.record_period_shots(uuid, uuid, integer, integer),
  public.record_goalie_stint(uuid, uuid, uuid, integer, integer, integer, integer, boolean, integer, integer, text) to authenticated;

grant execute on function public.get_game_shots_summary(uuid) to anon, authenticated;

commit;
