begin;

-- ============================================================================
-- Migration: 202611160025_cross_league_rankings.sql
-- Adds team power ratings, ELO calculations from approved games, and cross-league
-- network leaderboards comparing teams across all participating leagues.
-- ============================================================================

create table if not exists public.team_power_rankings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  team_name text not null check(length(trim(team_name)) between 1 and 100),
  skill_tier text not null default 'A' check(skill_tier in ('AAA', 'AA', 'A', 'B', 'C', 'D', 'Rec')),
  rating_score numeric(7,2) not null default 1000.00 check(rating_score >= 0),
  rank_position integer not null default 1 check(rank_position >= 1),
  games_played integer not null default 0 check(games_played >= 0),
  goal_differential integer not null default 0,
  last_calculated_at timestamptz not null default now(),
  unique(league_id, team_id)
);

create index if not exists idx_rankings_rating on public.team_power_rankings(rating_score desc);
create index if not exists idx_rankings_league on public.team_power_rankings(league_id, rank_position);

alter table public.team_power_rankings enable row level security;

grant select on public.team_power_rankings to anon, authenticated;
grant all on public.team_power_rankings to authenticated;

drop policy if exists rankings_public_read on public.team_power_rankings;
create policy rankings_public_read on public.team_power_rankings for select using (true);

drop policy if exists rankings_comm_all on public.team_power_rankings;
create policy rankings_comm_all on public.team_power_rankings for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: calculate_league_power_rankings
-- ============================================================================
create or replace function public.calculate_league_power_rankings(target_league uuid)
returns setof public.team_power_rankings
language plpgsql
security definer
set search_path=''
as $$
declare
  target_team record;
  calc_gp int;
  calc_pts int;
  calc_gf int;
  calc_ga int;
  calc_diff int;
  calc_score numeric(7,2);
  calc_rank int := 1;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  -- Temporary standings calculation per team from approved game results
  for target_team in
    with team_stats as (
      select
        t.id as team_id,
        t.name as team_name,
        coalesce(count(gr.game_id), 0) as gp,
        coalesce(sum(case
          when gr.home_score > gr.away_score and g.home_entry_id = te.id then 2
          when gr.away_score > gr.home_score and g.away_entry_id = te.id then 2
          when gr.decision in ('overtime','shootout') and gr.home_score < gr.away_score and g.home_entry_id = te.id then 1
          when gr.decision in ('overtime','shootout') and gr.away_score < gr.home_score and g.away_entry_id = te.id then 1
          when gr.decision = 'tie' then 1
          else 0 end), 0) as points,
        coalesce(sum(case when g.home_entry_id = te.id then gr.home_score else gr.away_score end), 0) as gf,
        coalesce(sum(case when g.home_entry_id = te.id then gr.away_score else gr.home_score end), 0) as ga
      from public.teams t
      join public.team_entries te on te.team_id = t.id and te.league_id = target_league
      left join public.games g on (g.home_entry_id = te.id or g.away_entry_id = te.id) and g.status = 'scheduled'
      left join public.game_results gr on gr.game_id = g.id and gr.status = 'approved'
      where t.league_id = target_league
      group by t.id, t.name
    )
    select * from team_stats
    order by points desc, (gf - ga) desc
  loop
    calc_gp := target_team.gp;
    calc_pts := target_team.points;
    calc_gf := target_team.gf;
    calc_ga := target_team.ga;
    calc_diff := calc_gf - calc_ga;

    -- Base ELO 1000 + (Points * 25) + (Diff * 5)
    calc_score := 1000.00 + (calc_pts * 25.0) + (calc_diff * 5.0);
    if calc_score < 100.00 then
      calc_score := 100.00;
    end if;

    insert into public.team_power_rankings (
      league_id, team_id, team_name, skill_tier, rating_score, rank_position,
      games_played, goal_differential, last_calculated_at
    )
    values (
      target_league, target_team.team_id, target_team.team_name, 'A', calc_score, calc_rank,
      calc_gp, calc_diff, now()
    )
    on conflict (league_id, team_id) do update
    set team_name = excluded.team_name,
        rating_score = excluded.rating_score,
        rank_position = excluded.rank_position,
        games_played = excluded.games_played,
        goal_differential = excluded.goal_differential,
        last_calculated_at = now();

    calc_rank := calc_rank + 1;
  end loop;

  return query
  select * from public.team_power_rankings
  where league_id = target_league
  order by rank_position asc;
end;
$$;

grant execute on function public.calculate_league_power_rankings(uuid) to authenticated;

-- ============================================================================
-- RPC: get_network_cross_league_rankings
-- Compares teams across all participating leagues in the network
-- ============================================================================
create or replace function public.get_network_cross_league_rankings(p_skill_tier text default null)
returns table (
  network_rank bigint,
  team_id uuid,
  team_name text,
  league_id uuid,
  league_name text,
  skill_tier text,
  rating_score numeric(7,2),
  games_played integer,
  goal_differential integer
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return query
  select
    row_number() over (order by tpr.rating_score desc, tpr.goal_differential desc) as network_rank,
    tpr.team_id,
    tpr.team_name,
    tpr.league_id,
    l.name as league_name,
    tpr.skill_tier,
    tpr.rating_score,
    tpr.games_played,
    tpr.goal_differential
  from public.team_power_rankings tpr
  join public.leagues l on l.id = tpr.league_id
  where (p_skill_tier is null or tpr.skill_tier = p_skill_tier)
  order by tpr.rating_score desc, tpr.goal_differential desc
  limit 100;
end;
$$;

grant execute on function public.get_network_cross_league_rankings(text) to anon, authenticated;

commit;
