begin;

-- ============================================================================
-- Migration: 202611160017_historical_season_import.sql
-- Enables commissioners to import historical/archival seasons, standings,
-- and career scoring/goalie records with identity resolution for players.
-- ============================================================================

create table if not exists public.historical_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_name text not null check(length(trim(season_name)) between 1 and 100),
  year_label text check(year_label is null or length(trim(year_label)) between 1 and 30),
  champion_team text check(champion_team is null or length(trim(champion_team)) between 1 and 100),
  runner_up_team text check(runner_up_team is null or length(trim(runner_up_team)) between 1 and 100),
  notes text,
  imported_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (league_id, season_name)
);

create table if not exists public.historical_standings (
  id uuid primary key default gen_random_uuid(),
  historical_season_id uuid not null references public.historical_seasons(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  division_name text not null default 'General',
  team_name text not null check(length(trim(team_name)) between 1 and 100),
  rank_position integer not null default 1 check(rank_position >= 1),
  games_played integer not null default 0 check(games_played >= 0),
  wins integer not null default 0 check(wins >= 0),
  losses integer not null default 0 check(losses >= 0),
  ties integer not null default 0 check(ties >= 0),
  overtime_losses integer not null default 0 check(overtime_losses >= 0),
  points integer not null default 0 check(points >= 0),
  goals_for integer not null default 0 check(goals_for >= 0),
  goals_against integer not null default 0 check(goals_against >= 0),
  penalty_minutes integer not null default 0 check(penalty_minutes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.historical_skater_stats (
  id uuid primary key default gen_random_uuid(),
  historical_season_id uuid not null references public.historical_seasons(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null check(length(trim(player_name)) between 1 and 100),
  team_name text not null check(length(trim(team_name)) between 1 and 100),
  position text default 'F',
  games_played integer not null default 0 check(games_played >= 0),
  goals integer not null default 0 check(goals >= 0),
  assists integer not null default 0 check(assists >= 0),
  points integer not null default 0 check(points >= 0),
  penalty_minutes integer not null default 0 check(penalty_minutes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.historical_goalie_stats (
  id uuid primary key default gen_random_uuid(),
  historical_season_id uuid not null references public.historical_seasons(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null check(length(trim(player_name)) between 1 and 100),
  team_name text not null check(length(trim(team_name)) between 1 and 100),
  games_played integer not null default 0 check(games_played >= 0),
  wins integer not null default 0 check(wins >= 0),
  losses integer not null default 0 check(losses >= 0),
  ties integer not null default 0 check(ties >= 0),
  overtime_losses integer not null default 0 check(overtime_losses >= 0),
  shots_against integer not null default 0 check(shots_against >= 0),
  saves integer not null default 0 check(saves >= 0),
  goals_against integer not null default 0 check(goals_against >= 0),
  shutouts integer not null default 0 check(shutouts >= 0),
  goals_against_average numeric(6,2) not null default 0.00,
  save_percentage numeric(6,3) not null default 0.000,
  created_at timestamptz not null default now()
);

create index if not exists idx_hist_standings_season on public.historical_standings(historical_season_id);
create index if not exists idx_hist_skaters_season on public.historical_skater_stats(historical_season_id);
create index if not exists idx_hist_goalies_season on public.historical_goalie_stats(historical_season_id);
create index if not exists idx_hist_skaters_player on public.historical_skater_stats(player_id);
create index if not exists idx_hist_goalies_player on public.historical_goalie_stats(player_id);

alter table public.historical_seasons enable row level security;
alter table public.historical_standings enable row level security;
alter table public.historical_skater_stats enable row level security;
alter table public.historical_goalie_stats enable row level security;

grant select on public.historical_seasons, public.historical_standings,
  public.historical_skater_stats, public.historical_goalie_stats to anon, authenticated;
grant all on public.historical_seasons, public.historical_standings,
  public.historical_skater_stats, public.historical_goalie_stats to authenticated;

drop policy if exists historical_seasons_public_read on public.historical_seasons;
create policy historical_seasons_public_read on public.historical_seasons for select using (true);

drop policy if exists historical_standings_public_read on public.historical_standings;
create policy historical_standings_public_read on public.historical_standings for select using (true);

drop policy if exists historical_skaters_public_read on public.historical_skater_stats;
create policy historical_skaters_public_read on public.historical_skater_stats for select using (true);

drop policy if exists historical_goalies_public_read on public.historical_goalie_stats;
create policy historical_goalies_public_read on public.historical_goalie_stats for select using (true);

drop policy if exists historical_seasons_comm_all on public.historical_seasons;
create policy historical_seasons_comm_all on public.historical_seasons for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists historical_standings_comm_all on public.historical_standings;
create policy historical_standings_comm_all on public.historical_standings for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists historical_skaters_comm_all on public.historical_skater_stats;
create policy historical_skaters_comm_all on public.historical_skater_stats for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

drop policy if exists historical_goalies_comm_all on public.historical_goalie_stats;
create policy historical_goalies_comm_all on public.historical_goalie_stats for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: import_historical_season
-- ============================================================================
create or replace function public.import_historical_season(
  target_league uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  hist_season_id uuid;
  s_name text;
  s_year text;
  s_champ text;
  s_runner text;
  s_notes text;
  auto_match bool;
  standings_arr jsonb;
  skaters_arr jsonb;
  goalies_arr jsonb;
  item jsonb;
  p_name text;
  resolved_pid uuid;
  n_standings int := 0;
  n_skaters int := 0;
  n_goalies int := 0;
  n_matched int := 0;
  calc_gaa numeric(6,2);
  calc_svpct numeric(6,3);
  gp_val int;
  ga_val int;
  saves_val int;
  shots_val int;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  s_name := trim(payload->>'season_name');
  if s_name is null or length(s_name) < 1 then
    raise exception using errcode='22023', message='Season name is required';
  end if;

  s_year := nullif(trim(payload->>'year_label'), '');
  s_champ := nullif(trim(payload->>'champion_team'), '');
  s_runner := nullif(trim(payload->>'runner_up_team'), '');
  s_notes := nullif(trim(payload->>'notes'), '');
  auto_match := coalesce((payload->>'auto_match_players')::boolean, true);

  insert into public.historical_seasons (
    league_id, season_name, year_label, champion_team, runner_up_team, notes, imported_by
  )
  values (
    target_league, s_name, s_year, s_champ, s_runner, s_notes, auth.uid()
  )
  on conflict (league_id, season_name) do update
  set year_label = excluded.year_label,
      champion_team = excluded.champion_team,
      runner_up_team = excluded.runner_up_team,
      notes = excluded.notes,
      imported_by = excluded.imported_by
  returning id into hist_season_id;

  -- Delete previous imports for clean re-import
  delete from public.historical_standings where historical_season_id = hist_season_id;
  delete from public.historical_skater_stats where historical_season_id = hist_season_id;
  delete from public.historical_goalie_stats where historical_season_id = hist_season_id;

  -- 1. Import Standings
  standings_arr := payload->'standings';
  if standings_arr is not null and jsonb_typeof(standings_arr) = 'array' then
    for item in select * from jsonb_array_elements(standings_arr) loop
      insert into public.historical_standings (
        historical_season_id,
        league_id,
        division_name,
        team_name,
        rank_position,
        games_played,
        wins,
        losses,
        ties,
        overtime_losses,
        points,
        goals_for,
        goals_against,
        penalty_minutes
      )
      values (
        hist_season_id,
        target_league,
        coalesce(nullif(trim(item->>'division_name'), ''), 'General'),
        coalesce(nullif(trim(item->>'team_name'), ''), 'Unknown Team'),
        coalesce((item->>'rank')::integer, coalesce((item->>'rank_position')::integer, 1)),
        coalesce((item->>'games_played')::integer, coalesce((item->>'gp')::integer, 0)),
        coalesce((item->>'wins')::integer, coalesce((item->>'w')::integer, 0)),
        coalesce((item->>'losses')::integer, coalesce((item->>'l')::integer, 0)),
        coalesce((item->>'ties')::integer, coalesce((item->>'t')::integer, 0)),
        coalesce((item->>'overtime_losses')::integer, coalesce((item->>'otl')::integer, 0)),
        coalesce((item->>'points')::integer, coalesce((item->>'pts')::integer, 0)),
        coalesce((item->>'goals_for')::integer, coalesce((item->>'gf')::integer, 0)),
        coalesce((item->>'goals_against')::integer, coalesce((item->>'ga')::integer, 0)),
        coalesce((item->>'penalty_minutes')::integer, coalesce((item->>'pim')::integer, 0))
      );
      n_standings := n_standings + 1;
    end loop;
  end if;

  -- 2. Import Skater Stats with Player Identity Matching
  skaters_arr := payload->'skaters';
  if skaters_arr is not null and jsonb_typeof(skaters_arr) = 'array' then
    for item in select * from jsonb_array_elements(skaters_arr) loop
      p_name := trim(item->>'player_name');
      if p_name is not null and length(p_name) > 0 then
        resolved_pid := null;
        if auto_match then
          select p.id into resolved_pid
          from public.players p
          join public.league_players lp on lp.player_id = p.id and lp.league_id = target_league
          where lower(trim(p.display_name)) = lower(p_name)
          limit 1;
          if resolved_pid is not null then
            n_matched := n_matched + 1;
          end if;
        end if;

        insert into public.historical_skater_stats (
          historical_season_id,
          league_id,
          player_id,
          player_name,
          team_name,
          position,
          games_played,
          goals,
          assists,
          points,
          penalty_minutes
        )
        values (
          hist_season_id,
          target_league,
          resolved_pid,
          p_name,
          coalesce(nullif(trim(item->>'team_name'), ''), 'Unaffiliated'),
          coalesce(nullif(upper(trim(item->>'position')), ''), 'F'),
          coalesce((item->>'games_played')::integer, coalesce((item->>'gp')::integer, 0)),
          coalesce((item->>'goals')::integer, coalesce((item->>'g')::integer, 0)),
          coalesce((item->>'assists')::integer, coalesce((item->>'a')::integer, 0)),
          coalesce((item->>'points')::integer, coalesce((item->>'pts')::integer, 0)),
          coalesce((item->>'penalty_minutes')::integer, coalesce((item->>'pim')::integer, 0))
        );
        n_skaters := n_skaters + 1;
      end if;
    end loop;
  end if;

  -- 3. Import Goalie Stats with Identity Matching
  goalies_arr := payload->'goalies';
  if goalies_arr is not null and jsonb_typeof(goalies_arr) = 'array' then
    for item in select * from jsonb_array_elements(goalies_arr) loop
      p_name := trim(item->>'player_name');
      if p_name is not null and length(p_name) > 0 then
        resolved_pid := null;
        if auto_match then
          select p.id into resolved_pid
          from public.players p
          join public.league_players lp on lp.player_id = p.id and lp.league_id = target_league
          where lower(trim(p.display_name)) = lower(p_name)
          limit 1;
          if resolved_pid is not null then
            n_matched := n_matched + 1;
          end if;
        end if;

        gp_val := coalesce((item->>'games_played')::integer, coalesce((item->>'gp')::integer, 0));
        ga_val := coalesce((item->>'goals_against')::integer, coalesce((item->>'ga')::integer, 0));
        saves_val := coalesce((item->>'saves')::integer, coalesce((item->>'sv')::integer, 0));
        shots_val := coalesce((item->>'shots_against')::integer, coalesce((item->>'shots')::integer, (saves_val + ga_val)));

        if gp_val > 0 then
          calc_gaa := round((ga_val::numeric / gp_val::numeric), 2);
        else
          calc_gaa := 0.00;
        end if;

        if shots_val > 0 then
          calc_svpct := round((saves_val::numeric / shots_val::numeric), 3);
        else
          calc_svpct := 0.000;
        end if;

        insert into public.historical_goalie_stats (
          historical_season_id,
          league_id,
          player_id,
          player_name,
          team_name,
          games_played,
          wins,
          losses,
          ties,
          overtime_losses,
          shots_against,
          saves,
          goals_against,
          shutouts,
          goals_against_average,
          save_percentage
        )
        values (
          hist_season_id,
          target_league,
          resolved_pid,
          p_name,
          coalesce(nullif(trim(item->>'team_name'), ''), 'Unaffiliated'),
          gp_val,
          coalesce((item->>'wins')::integer, coalesce((item->>'w')::integer, 0)),
          coalesce((item->>'losses')::integer, coalesce((item->>'l')::integer, 0)),
          coalesce((item->>'ties')::integer, coalesce((item->>'t')::integer, 0)),
          coalesce((item->>'overtime_losses')::integer, coalesce((item->>'otl')::integer, 0)),
          shots_val,
          saves_val,
          ga_val,
          coalesce((item->>'shutouts')::integer, coalesce((item->>'so')::integer, 0)),
          coalesce((item->>'gaa')::numeric, calc_gaa),
          coalesce((item->>'save_percentage')::numeric, coalesce((item->>'svpct')::numeric, calc_svpct))
        );
        n_goalies := n_goalies + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'historical_season_id', hist_season_id,
    'season_name', s_name,
    'standings_imported', n_standings,
    'skaters_imported', n_skaters,
    'goalies_imported', n_goalies,
    'matched_players', n_matched
  );
end;
$$;

grant execute on function public.import_historical_season(uuid, jsonb) to authenticated;

-- ============================================================================
-- RPC: link_historical_stat_player
-- Allows manual identity linking between an imported stat and an existing player profile
-- ============================================================================
create or replace function public.link_historical_stat_player(
  target_league uuid,
  stat_type text,
  target_stat_id uuid,
  target_player_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if target_player_id is not null then
    perform 1 from public.league_players
    where league_id = target_league and player_id = target_player_id;
    if not found then
      raise exception using errcode='P0002', message='PLAYER_NOT_IN_LEAGUE';
    end if;
  end if;

  if stat_type = 'skater' then
    update public.historical_skater_stats
    set player_id = target_player_id
    where id = target_stat_id and league_id = target_league;
    return found;
  elsif stat_type = 'goalie' then
    update public.historical_goalie_stats
    set player_id = target_player_id
    where id = target_stat_id and league_id = target_league;
    return found;
  else
    raise exception using errcode='22023', message='Invalid stat_type (skater or goalie expected)';
  end if;
end;
$$;

grant execute on function public.link_historical_stat_player(uuid, text, uuid, uuid) to authenticated;

-- ============================================================================
-- RPC: get_player_career_summary
-- Aggregates all approved live game stats + all historical season stats for a player
-- ============================================================================
create or replace function public.get_player_career_summary(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  p_display_name text;
  live_skater record;
  hist_skater record;
  live_goalie record;
  hist_goalie record;
  total_gp bigint;
  total_g bigint;
  total_a bigint;
  total_pts bigint;
  total_pim bigint;
  g_gp bigint;
  g_w bigint;
  g_l bigint;
  g_t bigint;
  g_ga bigint;
  g_saves bigint;
  g_so bigint;
  career_gaa numeric(6,2);
  career_svpct numeric(6,3);
begin
  select display_name into p_display_name
  from public.players
  where id = target_player_id;

  if p_display_name is null then
    raise exception using errcode='P0002', message='PLAYER_NOT_FOUND';
  end if;

  -- 1. Aggregated historical skater stats
  select
    coalesce(sum(games_played), 0) as gp,
    coalesce(sum(goals), 0) as g,
    coalesce(sum(assists), 0) as a,
    coalesce(sum(points), 0) as pts,
    coalesce(sum(penalty_minutes), 0) as pim
  into hist_skater
  from public.historical_skater_stats
  where player_id = target_player_id;

  -- 2. Aggregated live skater stats from approved games
  with approved_games as (
    select gr.game_id
    from public.game_results gr
    where gr.status = 'approved'
  ),
  valid_events as (
    select ge.*
    from public.game_events ge
    join approved_games ag on ag.game_id = ge.game_id
    where not exists (select 1 from public.game_event_voids gv where gv.event_id = ge.id)
  ),
  goals_count as (
    select count(*) as cnt from valid_events
    where event_kind = 'goal' and player_id = target_player_id
  ),
  primary_assists as (
    select count(*) as cnt from valid_events
    where event_kind = 'goal' and assist_one_id = target_player_id
  ),
  secondary_assists as (
    select count(*) as cnt from valid_events
    where event_kind = 'goal' and assist_two_id = target_player_id
  ),
  penalties as (
    select coalesce(sum(penalty_minutes), 0) as pim
    from valid_events
    where event_kind = 'penalty' and player_id = target_player_id
  ),
  games_participated as (
    select count(distinct ge.game_id) as gp
    from valid_events ge
    where ge.player_id = target_player_id
       or ge.assist_one_id = target_player_id
       or ge.assist_two_id = target_player_id
  )
  select
    gp.gp,
    gc.cnt as g,
    (pa.cnt + sa.cnt) as a,
    (gc.cnt + pa.cnt + sa.cnt) as pts,
    pen.pim
  into live_skater
  from games_participated gp, goals_count gc, primary_assists pa, secondary_assists sa, penalties pen;

  total_gp := coalesce(hist_skater.gp, 0) + coalesce(live_skater.gp, 0);
  total_g := coalesce(hist_skater.g, 0) + coalesce(live_skater.g, 0);
  total_a := coalesce(hist_skater.a, 0) + coalesce(live_skater.a, 0);
  total_pts := total_g + total_a;
  total_pim := coalesce(hist_skater.pim, 0) + coalesce(live_skater.pim, 0);

  -- 3. Aggregated historical goalie stats
  select
    coalesce(sum(games_played), 0) as gp,
    coalesce(sum(wins), 0) as w,
    coalesce(sum(losses), 0) as l,
    coalesce(sum(ties + overtime_losses), 0) as t,
    coalesce(sum(goals_against), 0) as ga,
    coalesce(sum(saves), 0) as saves,
    coalesce(sum(shutouts), 0) as so
  into hist_goalie
  from public.historical_goalie_stats
  where player_id = target_player_id;

  g_gp := coalesce(hist_goalie.gp, 0);
  g_w := coalesce(hist_goalie.w, 0);
  g_l := coalesce(hist_goalie.l, 0);
  g_t := coalesce(hist_goalie.t, 0);
  g_ga := coalesce(hist_goalie.ga, 0);
  g_saves := coalesce(hist_goalie.saves, 0);
  g_so := coalesce(hist_goalie.so, 0);

  if g_gp > 0 then
    career_gaa := round((g_ga::numeric / g_gp::numeric), 2);
  else
    career_gaa := 0.00;
  end if;

  if (g_saves + g_ga) > 0 then
    career_svpct := round((g_saves::numeric / (g_saves + g_ga)::numeric), 3);
  else
    career_svpct := 0.000;
  end if;

  return jsonb_build_object(
    'player_id', target_player_id,
    'display_name', p_display_name,
    'skater', jsonb_build_object(
      'games_played', total_gp,
      'goals', total_g,
      'assists', total_a,
      'points', total_pts,
      'penalty_minutes', total_pim,
      'historical_gp', coalesce(hist_skater.gp, 0),
      'live_gp', coalesce(live_skater.gp, 0)
    ),
    'goalie', jsonb_build_object(
      'games_played', g_gp,
      'wins', g_w,
      'losses', g_l,
      'ties_or_otl', g_t,
      'goals_against', g_ga,
      'saves', g_saves,
      'shutouts', g_so,
      'gaa', career_gaa,
      'save_percentage', career_svpct
    )
  );
end;
$$;

grant execute on function public.get_player_career_summary(uuid) to anon, authenticated;

commit;
