begin;

-- ============================================================================
-- Migration: 202611160005_player_and_goalie_stats.sql
-- Adds season player scoring race & goaltending leaderboards computed
-- directly from approved game event logs with voided event exclusion.
-- ============================================================================

create or replace function public.get_season_skater_leaders(target_season uuid)
returns table(
  player_id uuid,
  display_name text,
  team_entry_id uuid,
  team_name text,
  jersey_number integer,
  player_position text,
  games_played bigint,
  goals bigint,
  assists bigint,
  points bigint,
  penalty_minutes bigint
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_league uuid;
begin
  select league_id into target_league from public.seasons where id = target_season;
  if target_league is null then
    raise exception using errcode='P0002', message='SEASON_NOT_FOUND';
  end if;

  return query
  with season_teams as (
    select
      te.id as team_entry_id,
      t.name as team_name
    from public.team_entries te
    join public.teams t on t.id = te.team_id and t.league_id = te.league_id
    join public.divisions d on d.id = te.division_id and d.league_id = te.league_id
    where d.season_id = target_season
  ),
  approved_games as (
    select
      g.id as game_id,
      g.home_entry_id,
      g.away_entry_id
    from public.games g
    join public.game_results gr on gr.game_id = g.id and gr.status = 'approved'
    where g.home_entry_id in (select st.team_entry_id from season_teams st)
  ),
  team_games as (
    select ag.game_id, ag.home_entry_id as team_entry_id from approved_games ag
    union all
    select ag.game_id, ag.away_entry_id as team_entry_id from approved_games ag
  ),
  roster_players as (
    select
      p.id as player_id,
      p.display_name,
      st.team_entry_id,
      st.team_name,
      rm.jersey_number,
      rm.position as player_position
    from public.roster_memberships rm
    join public.players p on p.id = rm.player_id
    join season_teams st on st.team_entry_id = rm.team_entry_id
    where rm.status = 'active'
      and rm.position in ('F', 'D', 'C', 'LW', 'RW')
  ),
  player_gp as (
    select
      rp.player_id,
      count(distinct tg.game_id)::bigint as gp
    from roster_players rp
    join team_games tg on tg.team_entry_id = rp.team_entry_id
    where not exists (
      select 1 from public.game_attendance ga
      where ga.game_id = tg.game_id
        and ga.player_id = rp.player_id
        and ga.status = 'out'
    )
    group by rp.player_id
  ),
  player_goals as (
    select
      ge.player_id,
      count(*)::bigint as g_count
    from public.game_events ge
    join approved_games ag on ag.game_id = ge.game_id
    where ge.event_kind = 'goal'
      and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id)
    group by ge.player_id
  ),
  player_assists as (
    select
      a.assist_player_id as player_id,
      count(*)::bigint as a_count
    from (
      select ge.assist_one_id as assist_player_id
      from public.game_events ge
      join approved_games ag on ag.game_id = ge.game_id
      where ge.event_kind = 'goal' and ge.assist_one_id is not null
        and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id)
      union all
      select ge.assist_two_id as assist_player_id
      from public.game_events ge
      join approved_games ag on ag.game_id = ge.game_id
      where ge.event_kind = 'goal' and ge.assist_two_id is not null
        and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id)
    ) a
    group by a.assist_player_id
  ),
  player_pim as (
    select
      ge.player_id,
      coalesce(sum(ge.penalty_minutes), 0)::bigint as pim_count
    from public.game_events ge
    join approved_games ag on ag.game_id = ge.game_id
    where ge.event_kind = 'penalty'
      and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id)
    group by ge.player_id
  )
  select
    rp.player_id,
    rp.display_name,
    rp.team_entry_id,
    rp.team_name,
    rp.jersey_number,
    rp.player_position,
    coalesce(pgp.gp, 0)::bigint as games_played,
    coalesce(pg.g_count, 0)::bigint as goals,
    coalesce(pa.a_count, 0)::bigint as assists,
    (coalesce(pg.g_count, 0) + coalesce(pa.a_count, 0))::bigint as points,
    coalesce(pp.pim_count, 0)::bigint as penalty_minutes
  from roster_players rp
  left join player_gp pgp on pgp.player_id = rp.player_id
  left join player_goals pg on pg.player_id = rp.player_id
  left join player_assists pa on pa.player_id = rp.player_id
  left join player_pim pp on pp.player_id = rp.player_id
  order by
    (coalesce(pg.g_count, 0) + coalesce(pa.a_count, 0)) desc,
    coalesce(pg.g_count, 0) desc,
    coalesce(pa.a_count, 0) desc,
    coalesce(pp.pim_count, 0) asc,
    rp.display_name asc;
end;
$$;

create or replace function public.get_season_goalie_leaders(target_season uuid)
returns table(
  player_id uuid,
  display_name text,
  team_entry_id uuid,
  team_name text,
  jersey_number integer,
  games_played bigint,
  goals_against bigint,
  goals_against_average numeric,
  shutouts bigint
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_league uuid;
begin
  select league_id into target_league from public.seasons where id = target_season;
  if target_league is null then
    raise exception using errcode='P0002', message='SEASON_NOT_FOUND';
  end if;

  return query
  with season_teams as (
    select
      te.id as team_entry_id,
      t.name as team_name
    from public.team_entries te
    join public.teams t on t.id = te.team_id and t.league_id = te.league_id
    join public.divisions d on d.id = te.division_id and d.league_id = te.league_id
    where d.season_id = target_season
  ),
  approved_games as (
    select
      g.id as game_id,
      g.home_entry_id,
      g.away_entry_id
    from public.games g
    join public.game_results gr on gr.game_id = g.id and gr.status = 'approved'
    where g.home_entry_id in (select st.team_entry_id from season_teams st)
  ),
  team_games as (
    select ag.game_id, ag.home_entry_id as team_entry_id from approved_games ag
    union all
    select ag.game_id, ag.away_entry_id as team_entry_id from approved_games ag
  ),
  goalies as (
    select
      p.id as player_id,
      p.display_name,
      st.team_entry_id,
      st.team_name,
      rm.jersey_number
    from public.roster_memberships rm
    join public.players p on p.id = rm.player_id
    join season_teams st on st.team_entry_id = rm.team_entry_id
    where rm.status = 'active'
      and rm.position = 'G'
  ),
  team_game_ga as (
    select
      tg.team_entry_id,
      tg.game_id,
      count(ge.id)::bigint as ga_in_game
    from team_games tg
    left join public.game_events ge
      on ge.game_id = tg.game_id
      and ge.event_kind = 'goal'
      and ge.team_entry_id <> tg.team_entry_id
      and not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id)
    group by tg.team_entry_id, tg.game_id
  ),
  goalie_stats as (
    select
      g.player_id,
      count(distinct tg.game_id)::bigint as gp,
      coalesce(sum(ga.ga_in_game), 0)::bigint as total_ga,
      count(case when coalesce(ga.ga_in_game, 0) = 0 then 1 end)::bigint as so
    from goalies g
    join team_games tg on tg.team_entry_id = g.team_entry_id
    left join team_game_ga ga on ga.game_id = tg.game_id and ga.team_entry_id = g.team_entry_id
    where not exists (
      select 1 from public.game_attendance a
      where a.game_id = tg.game_id
        and a.player_id = g.player_id
        and a.status = 'out'
    )
    group by g.player_id
  )
  select
    g.player_id,
    g.display_name,
    g.team_entry_id,
    g.team_name,
    g.jersey_number,
    coalesce(gs.gp, 0)::bigint as games_played,
    coalesce(gs.total_ga, 0)::bigint as goals_against,
    case
      when coalesce(gs.gp, 0) > 0 then round((coalesce(gs.total_ga, 0)::numeric / gs.gp), 2)
      else 0.00
    end as goals_against_average,
    coalesce(gs.so, 0)::bigint as shutouts
  from goalies g
  left join goalie_stats gs on gs.player_id = g.player_id
  order by
    case when coalesce(gs.gp, 0) > 0 then round((coalesce(gs.total_ga, 0)::numeric / gs.gp), 2) else 999 end asc,
    coalesce(gs.so, 0) desc,
    coalesce(gs.gp, 0) desc,
    g.display_name asc;
end;
$$;

revoke all on function public.get_season_skater_leaders(uuid),
  public.get_season_goalie_leaders(uuid) from public, anon, authenticated;

grant execute on function public.get_season_skater_leaders(uuid),
  public.get_season_goalie_leaders(uuid) to anon, authenticated;

commit;

