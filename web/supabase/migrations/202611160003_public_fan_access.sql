begin;

-- ============================================================================
-- Migration: 202611160003_public_fan_access.sql
-- Enables public fan and guest access to published schedules, standings,
-- game center / live scores, and league overview without requiring authentication.
-- All private tables (memberships, registrations, invoices, internal audits)
-- remain strictly protected by RLS.
-- ============================================================================

-- 1. Public league overview: returns active leagues, published seasons, divisions, teams
create or replace function public.get_public_league_overview(target_league uuid default null)
returns table(
  league_id uuid,
  league_name text,
  seasons jsonb,
  divisions jsonb,
  teams jsonb
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  resolved_league uuid;
  resolved_name text;
begin
  if target_league is not null then
    select id, name into resolved_league, resolved_name from public.leagues where id = target_league;
  else
    select id, name into resolved_league, resolved_name from public.leagues
    order by case
      when id = '60000000-0000-4000-8000-000000000001'::uuid then 0
      when id = '00000000-0000-4000-8000-000000000001'::uuid then 1
      else 2 end, name
    limit 1;
  end if;

  if resolved_league is null then
    return;
  end if;

  return query
  with s_data as (
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb) as seasons
    from public.seasons s
    where s.league_id = resolved_league
  ),
  d_data as (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'season_id', d.season_id) order by d.name), '[]'::jsonb) as divisions
    from public.divisions d
    where d.league_id = resolved_league
  ),
  t_data as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'entry_id', e.id,
      'division_id', e.division_id,
      'division_name', d.name,
      'season_name', s.name
    ) order by t.name), '[]'::jsonb) as teams
    from public.team_entries e
    join public.teams t on t.id = e.team_id and t.league_id = e.league_id
    join public.divisions d on d.id = e.division_id and d.league_id = e.league_id
    join public.seasons s on s.id = d.season_id and s.league_id = d.league_id
    where e.league_id = resolved_league
  )
  select
    resolved_league as league_id,
    resolved_name as league_name,
    s_data.seasons,
    d_data.divisions,
    t_data.teams
  from s_data, d_data, t_data;
end;
$$;

-- 2. Public schedule: returns published (non-draft) fixtures with venue, rink, and scores
create or replace function public.get_public_schedule(target_league uuid, target_season uuid default null)
returns table(
  game_id uuid,
  season_id uuid,
  season_name text,
  division_id uuid,
  division_name text,
  home_entry_id uuid,
  home_team_name text,
  away_entry_id uuid,
  away_team_name text,
  venue_name text,
  rink_name text,
  time_zone text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  home_score integer,
  away_score integer,
  decision text
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return query
  select
    g.id as game_id,
    s.id as season_id,
    s.name as season_name,
    d.id as division_id,
    d.name as division_name,
    g.home_entry_id,
    ht.name as home_team_name,
    g.away_entry_id,
    at.name as away_team_name,
    coalesce(v.name, 'TBD') as venue_name,
    coalesce(r.name, 'TBD') as rink_name,
    coalesce(v.time_zone, 'America/Toronto') as time_zone,
    g.starts_at,
    g.ends_at,
    g.status,
    gr.home_score,
    gr.away_score,
    gr.decision
  from public.games g
  join public.team_entries he on he.id = g.home_entry_id and he.league_id = g.league_id
  join public.teams ht on ht.id = he.team_id and ht.league_id = he.league_id
  join public.divisions d on d.id = he.division_id and d.league_id = he.league_id
  join public.seasons s on s.id = d.season_id and s.league_id = d.league_id
  join public.team_entries ae on ae.id = g.away_entry_id and ae.league_id = g.league_id
  join public.teams at on at.id = ae.team_id and at.league_id = ae.league_id
  left join public.rinks r on r.id = g.rink_id and r.league_id = g.league_id
  left join public.venues v on v.id = r.venue_id and v.league_id = r.league_id
  left join public.game_results gr on gr.game_id = g.id and gr.league_id = g.league_id and gr.status = 'approved'
  where g.league_id = target_league
    and g.status <> 'draft'
    and (target_season is null or s.id = target_season)
  order by g.starts_at asc;
end;
$$;

-- 3. Public Game Center: live score, period, clock, and event timeline for published games
create or replace function public.get_public_live_game(target_game uuid)
returns table(
  game_id uuid,
  league_id uuid,
  league_name text,
  season_name text,
  division_name text,
  home_team_name text,
  away_team_name text,
  venue_name text,
  rink_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  home_score integer,
  away_score integer,
  events jsonb
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  g_rec record;
  v_home_score integer := 0;
  v_away_score integer := 0;
  ev_json jsonb;
begin
  select
    g.id, g.league_id, l.name as league_name, s.name as season_name, d.name as division_name,
    ht.name as home_team_name, at.name as away_team_name,
    v.name as venue_name, r.name as rink_name, g.starts_at, g.ends_at, g.status,
    g.home_entry_id, g.away_entry_id
  into g_rec
  from public.games g
  join public.leagues l on l.id = g.league_id
  join public.team_entries he on he.id = g.home_entry_id and he.league_id = g.league_id
  join public.teams ht on ht.id = he.team_id and ht.league_id = he.league_id
  join public.divisions d on d.id = he.division_id and d.league_id = he.league_id
  join public.seasons s on s.id = d.season_id and s.league_id = d.league_id
  join public.team_entries ae on ae.id = g.away_entry_id and ae.league_id = g.league_id
  join public.teams at on at.id = ae.team_id and at.league_id = ae.league_id
  left join public.rinks r on r.id = g.rink_id and r.league_id = g.league_id
  left join public.venues v on v.id = r.venue_id and v.league_id = r.league_id
  where g.id = target_game and g.status <> 'draft';

  if g_rec.id is null then
    return;
  end if;

  select
    coalesce(count(*) filter (where ge.team_entry_id = g_rec.home_entry_id and ge.event_kind = 'goal'), 0)::integer,
    coalesce(count(*) filter (where ge.team_entry_id = g_rec.away_entry_id and ge.event_kind = 'goal'), 0)::integer
  into v_home_score, v_away_score
  from public.game_events ge
  where ge.game_id = target_game
    and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ge.id,
    'period', ge.period,
    'clock_seconds_remaining', ge.clock_seconds_remaining,
    'event_kind', ge.event_kind,
    'team_entry_id', ge.team_entry_id,
    'team_name', case when ge.team_entry_id = g_rec.home_entry_id then g_rec.home_team_name else g_rec.away_team_name end,
    'player_name', coalesce(pl.display_name, 'Player'),
    'jersey_number', coalesce(rm.jersey_number, 0),
    'penalty_minutes', ge.penalty_minutes,
    'recorded_at', ge.recorded_at
  ) order by ge.period asc, ge.clock_seconds_remaining desc, ge.recorded_at asc), '[]'::jsonb)
  into ev_json
  from public.game_events ge
  left join public.players pl on pl.id = ge.player_id
  left join public.roster_memberships rm on rm.team_entry_id = ge.team_entry_id and rm.player_id = ge.player_id
  where ge.game_id = target_game
    and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id);

  return query select
    g_rec.id,
    g_rec.league_id,
    g_rec.league_name,
    g_rec.season_name,
    g_rec.division_name,
    g_rec.home_team_name,
    g_rec.away_team_name,
    coalesce(g_rec.venue_name, 'TBD'),
    coalesce(g_rec.rink_name, 'TBD'),
    g_rec.starts_at,
    g_rec.ends_at,
    g_rec.status,
    v_home_score,
    v_away_score,
    ev_json;
end;
$$;

-- 4. Standings: Allow public fan access to get_season_standings
create or replace function public.get_season_standings(target_season uuid)
returns table(
 division_id uuid,division_name text,team_entry_id uuid,team_name text,rank bigint,
 games_played bigint,wins bigint,ties bigint,losses bigint,overtime_losses bigint,
 goals_for bigint,goals_against bigint,goal_difference bigint,penalty_minutes bigint,
 points bigint,head_to_head_points bigint
) language plpgsql stable security definer set search_path='' as $$
declare target_league uuid;
begin
 select league_id into target_league from public.seasons where id=target_season;
 if target_league is null then
  raise exception using errcode='P0002',message='SEASON_NOT_FOUND';
 end if;
 return query
 with teams as (
  select e.id team_entry_id,e.division_id,d.name division_name,t.name team_name,s.league_id,
   coalesce(ss.win_points,2) win_points,coalesce(ss.tie_points,1) tie_points,
   coalesce(ss.loss_points,0) loss_points,coalesce(ss.overtime_loss_points,1) overtime_loss_points,
   coalesce(ss.standings_tiebreakers,array['wins','goal_difference','goals_for','head_to_head','fewest_penalties']::text[]) tie_order
  from public.team_entries e
  join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  join public.teams t on t.id=e.team_id and t.league_id=e.league_id
  join public.seasons s on s.id=d.season_id and s.league_id=d.league_id
  left join public.season_settings ss on ss.season_id=s.id and ss.league_id=s.league_id
  where s.id=target_season
 ), approved_games as (
  select r.game_id,r.home_entry_id,r.away_entry_id,r.home_score,r.away_score,
   r.home_penalty_minutes,r.away_penalty_minutes,r.decision
  from public.game_results r where r.league_id=target_league and r.status='approved'
 ), sides as (
  select t.division_id,t.team_entry_id,r.away_entry_id opponent_id,r.home_score goals_for,r.away_score goals_against,
   r.home_penalty_minutes penalty_minutes,r.decision,
   case when r.home_score=r.away_score then 'tie'
    when r.home_score>r.away_score then 'win'
    when r.decision in ('overtime','shootout') then 'overtime_loss' else 'loss' end outcome,
   case when r.home_score=r.away_score then t.tie_points
    when r.home_score>r.away_score then t.win_points
    when r.decision in ('overtime','shootout') then t.overtime_loss_points else t.loss_points end awarded_points
  from approved_games r join teams t on t.team_entry_id=r.home_entry_id
  union all
  select t.division_id,t.team_entry_id,r.home_entry_id opponent_id,r.away_score goals_for,r.home_score goals_against,
   r.away_penalty_minutes penalty_minutes,r.decision,
   case when r.home_score=r.away_score then 'tie'
    when r.away_score>r.home_score then 'win'
    when r.decision in ('overtime','shootout') then 'overtime_loss' else 'loss' end outcome,
   case when r.home_score=r.away_score then t.tie_points
    when r.away_score>r.home_score then t.win_points
    when r.decision in ('overtime','shootout') then t.overtime_loss_points else t.loss_points end awarded_points
  from approved_games r join teams t on t.team_entry_id=r.away_entry_id
 ), totals as (
  select t.division_id,t.team_entry_id,t.division_name,t.team_name,t.tie_order,
   count(s.team_entry_id)::bigint games_played,
   count(*) filter(where s.outcome='win')::bigint wins,
   count(*) filter(where s.outcome='tie')::bigint ties,
   count(*) filter(where s.outcome='loss')::bigint losses,
   count(*) filter(where s.outcome='overtime_loss')::bigint overtime_losses,
   coalesce(sum(s.goals_for),0)::bigint goals_for,
   coalesce(sum(s.goals_against),0)::bigint goals_against,
   coalesce(sum(s.goals_for-s.goals_against),0)::bigint goal_difference,
   coalesce(sum(s.penalty_minutes),0)::bigint penalty_minutes,
   coalesce(sum(s.awarded_points),0)::bigint points
  from teams t left join sides s on s.team_entry_id=t.team_entry_id
  group by t.division_id,t.team_entry_id,t.division_name,t.team_name,t.tie_order
 ), head_to_head as (
  select s.team_entry_id,coalesce(sum(s.awarded_points),0)::bigint head_to_head_points
  from sides s join totals own on own.team_entry_id=s.team_entry_id
  join totals opponent on opponent.team_entry_id=s.opponent_id
   and opponent.division_id=own.division_id and opponent.points=own.points
  group by s.team_entry_id
 ), ranked as (
  select t.*,coalesce(h.head_to_head_points,0)::bigint head_to_head_points,
   row_number() over(partition by t.division_id order by t.points desc,
    case when t.tie_order[1]='wins' then t.wins end desc,
    case when t.tie_order[1]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[1]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[1]='goals_for' then t.goals_for end desc,
    case when t.tie_order[1]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[2]='wins' then t.wins end desc,
    case when t.tie_order[2]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[2]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[2]='goals_for' then t.goals_for end desc,
    case when t.tie_order[2]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[3]='wins' then t.wins end desc,
    case when t.tie_order[3]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[3]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[3]='goals_for' then t.goals_for end desc,
    case when t.tie_order[3]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[4]='wins' then t.wins end desc,
    case when t.tie_order[4]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[4]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[4]='goals_for' then t.goals_for end desc,
    case when t.tie_order[4]='fewest_penalties' then t.penalty_minutes end asc,
    case when t.tie_order[5]='wins' then t.wins end desc,
    case when t.tie_order[5]='head_to_head' then coalesce(h.head_to_head_points,0) end desc,
    case when t.tie_order[5]='goal_difference' then t.goal_difference end desc,
    case when t.tie_order[5]='goals_for' then t.goals_for end desc,
    case when t.tie_order[5]='fewest_penalties' then t.penalty_minutes end asc,
    lower(t.team_name),t.team_entry_id) rank
  from totals t left join head_to_head h on h.team_entry_id=t.team_entry_id
 )
 select r.division_id,r.division_name,r.team_entry_id,r.team_name,r.rank,
  r.games_played,r.wins,r.ties,r.losses,r.overtime_losses,r.goals_for,r.goals_against,
  r.goal_difference,r.penalty_minutes,r.points,r.head_to_head_points
 from ranked r order by r.division_name,r.rank;
end; $$;

-- 5. Revoke from public, then grant execute to anon and authenticated
revoke all on function public.get_public_league_overview(uuid),
  public.get_public_schedule(uuid, uuid),
  public.get_public_live_game(uuid),
  public.get_season_standings(uuid) from public, anon, authenticated;

grant execute on function public.get_public_league_overview(uuid),
  public.get_public_schedule(uuid, uuid),
  public.get_public_live_game(uuid),
  public.get_season_standings(uuid) to anon, authenticated;

commit;
