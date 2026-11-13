begin;

-- ============================================================================
-- Migration: 202611160007_playoff_brackets.sql
-- Adds playoff tournament brackets, series seeding from regular season standings,
-- advancement logic, and public bracket viewing.
-- ============================================================================

create table public.playoff_tournaments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  division_id uuid not null references public.divisions(id),
  season_id uuid not null references public.seasons(id),
  name text not null check(length(trim(name)) between 2 and 120),
  format text not null check(format in ('single_elimination', 'best_of_3')),
  team_count integer not null check(team_count in (2, 4, 8)),
  status text not null default 'draft' check(status in ('draft', 'active', 'completed')),
  created_at timestamptz not null default now(),
  unique(division_id)
);

create table public.playoff_series (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  tournament_id uuid not null references public.playoff_tournaments(id) on delete cascade,
  round_number integer not null check(round_number between 1 and 4),
  series_order integer not null check(series_order between 1 and 8),
  high_seed_entry_id uuid references public.team_entries(id),
  low_seed_entry_id uuid references public.team_entries(id),
  high_seed_rank integer,
  low_seed_rank integer,
  high_seed_wins integer not null default 0 check(high_seed_wins >= 0),
  low_seed_wins integer not null default 0 check(low_seed_wins >= 0),
  winner_entry_id uuid references public.team_entries(id),
  next_series_id uuid references public.playoff_series(id),
  status text not null default 'scheduled' check(status in ('scheduled', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  unique(tournament_id, round_number, series_order)
);

create table public.playoff_series_games (
  series_id uuid not null references public.playoff_series(id) on delete cascade,
  game_id uuid not null references public.games(id),
  game_number integer not null check(game_number between 1 and 7),
  primary key(series_id, game_id)
);

alter table public.playoff_tournaments enable row level security;
alter table public.playoff_series enable row level security;
alter table public.playoff_series_games enable row level security;

revoke all on public.playoff_tournaments, public.playoff_series, public.playoff_series_games from anon, authenticated;
grant select on public.playoff_tournaments, public.playoff_series, public.playoff_series_games to anon, authenticated;
grant insert, update, delete on public.playoff_tournaments, public.playoff_series, public.playoff_series_games to authenticated;

-- Policies
create policy playoff_tournaments_read on public.playoff_tournaments for select to anon, authenticated using(true);
create policy playoff_tournaments_manage on public.playoff_tournaments for all to authenticated
  using(public.is_league_commissioner(league_id))
  with check(public.is_league_commissioner(league_id));

create policy playoff_series_read on public.playoff_series for select to anon, authenticated using(true);
create policy playoff_series_manage on public.playoff_series for all to authenticated
  using(public.is_league_commissioner(league_id))
  with check(public.is_league_commissioner(league_id));

create policy playoff_series_games_read on public.playoff_series_games for select to anon, authenticated using(true);
create policy playoff_series_games_manage on public.playoff_series_games for all to authenticated
  using(exists(select 1 from public.playoff_series s where s.id=series_id and public.is_league_commissioner(s.league_id)))
  with check(exists(select 1 from public.playoff_series s where s.id=series_id and public.is_league_commissioner(s.league_id)));

-- RPC: generate_playoff_bracket
create or replace function public.generate_playoff_bracket(
  target_division uuid,
  tournament_name text,
  playoff_format text,
  team_count integer
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  div_rec public.divisions;
  existing_t public.playoff_tournaments;
  tournament_id uuid;
  seeded_teams uuid[];
  t_count integer;
  final_series_id uuid;
  semi1_id uuid;
  semi2_id uuid;
  qf1_id uuid;
  qf2_id uuid;
  qf3_id uuid;
  qf4_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into div_rec from public.divisions where id = target_division;
  if div_rec.id is null then
    raise exception using errcode='P0002', message='DIVISION_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(div_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if playoff_format not in ('single_elimination', 'best_of_3') then
    raise exception using errcode='22023', message='Invalid playoff format';
  end if;

  if team_count not in (2, 4, 8) then
    raise exception using errcode='22023', message='Team count must be 2, 4, or 8';
  end if;

  -- Remove existing tournament if re-generating
  delete from public.playoff_tournaments where division_id = target_division;

  -- Fetch seeded teams for this division
  with ranked as (
    select
      te.id as entry_id,
      row_number() over (
        order by
          coalesce(st.points, 0) desc,
          coalesce(st.wins, 0) desc,
          coalesce(st.goal_difference, 0) desc,
          t.name asc
      ) as seed_num
    from public.team_entries te
    join public.teams t on t.id = te.team_id and t.league_id = te.league_id
    left join public.get_season_standings(div_rec.season_id) st on st.team_entry_id = te.id
    where te.division_id = target_division
  )
  select array_agg(entry_id order by seed_num asc) into seeded_teams from ranked;

  t_count := coalesce(array_length(seeded_teams, 1), 0);
  if t_count < team_count then
    raise exception using errcode='22023', message='Division only has ' || t_count || ' teams, cannot seed ' || team_count;
  end if;

  insert into public.playoff_tournaments (
    league_id,
    division_id,
    season_id,
    name,
    format,
    team_count,
    status
  )
  values (
    div_rec.league_id,
    target_division,
    div_rec.season_id,
    trim(tournament_name),
    playoff_format,
    team_count,
    'active'
  )
  returning id into tournament_id;

  if team_count = 2 then
    -- Round 1: Final
    insert into public.playoff_series (
      league_id, tournament_id, round_number, series_order,
      high_seed_entry_id, low_seed_entry_id,
      high_seed_rank, low_seed_rank, status
    ) values (
      div_rec.league_id, tournament_id, 1, 1,
      seeded_teams[1], seeded_teams[2],
      1, 2, 'scheduled'
    );

  elsif team_count = 4 then
    -- Round 2: Final
    insert into public.playoff_series (
      league_id, tournament_id, round_number, series_order,
      status
    ) values (
      div_rec.league_id, tournament_id, 2, 1, 'scheduled'
    ) returning id into final_series_id;

    -- Round 1: Semifinals
    insert into public.playoff_series (
      league_id, tournament_id, round_number, series_order,
      high_seed_entry_id, low_seed_entry_id,
      high_seed_rank, low_seed_rank,
      next_series_id, status
    ) values (
      div_rec.league_id, tournament_id, 1, 1,
      seeded_teams[1], seeded_teams[4],
      1, 4,
      final_series_id, 'scheduled'
    ), (
      div_rec.league_id, tournament_id, 1, 2,
      seeded_teams[2], seeded_teams[3],
      2, 3,
      final_series_id, 'scheduled'
    );

  elsif team_count = 8 then
    -- Round 3: Final
    insert into public.playoff_series (
      league_id, tournament_id, round_number, series_order, status
    ) values (div_rec.league_id, tournament_id, 3, 1, 'scheduled')
    returning id into final_series_id;

    -- Round 2: Semifinals
    insert into public.playoff_series (
      league_id, tournament_id, round_number, series_order, next_series_id, status
    ) values
      (div_rec.league_id, tournament_id, 2, 1, final_series_id, 'scheduled'),
      (div_rec.league_id, tournament_id, 2, 2, final_series_id, 'scheduled');

    select id into semi1_id from public.playoff_series where tournament_id = tournament_id and round_number = 2 and series_order = 1;
    select id into semi2_id from public.playoff_series where tournament_id = tournament_id and round_number = 2 and series_order = 2;

    -- Round 1: Quarterfinals
    insert into public.playoff_series (
      league_id, tournament_id, round_number, series_order,
      high_seed_entry_id, low_seed_entry_id, high_seed_rank, low_seed_rank,
      next_series_id, status
    ) values
      (div_rec.league_id, tournament_id, 1, 1, seeded_teams[1], seeded_teams[8], 1, 8, semi1_id, 'scheduled'),
      (div_rec.league_id, tournament_id, 1, 2, seeded_teams[4], seeded_teams[5], 4, 5, semi1_id, 'scheduled'),
      (div_rec.league_id, tournament_id, 1, 3, seeded_teams[2], seeded_teams[7], 2, 7, semi2_id, 'scheduled'),
      (div_rec.league_id, tournament_id, 1, 4, seeded_teams[3], seeded_teams[6], 3, 6, semi2_id, 'scheduled');
  end if;

  return tournament_id;
end;
$$;

-- RPC: get_playoff_bracket
create or replace function public.get_playoff_bracket(target_tournament uuid)
returns table(
  tournament_id uuid,
  league_id uuid,
  division_id uuid,
  season_id uuid,
  name text,
  format text,
  team_count integer,
  status text,
  series jsonb
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  t_rec public.playoff_tournaments;
  series_json jsonb;
begin
  select * into t_rec from public.playoff_tournaments where id = target_tournament;
  if t_rec.id is null then
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ps.id,
    'round_number', ps.round_number,
    'series_order', ps.series_order,
    'high_seed_entry_id', ps.high_seed_entry_id,
    'high_seed_name', coalesce(ht.name, 'TBD'),
    'high_seed_rank', ps.high_seed_rank,
    'high_seed_wins', ps.high_seed_wins,
    'low_seed_entry_id', ps.low_seed_entry_id,
    'low_seed_name', coalesce(lt.name, 'TBD'),
    'low_seed_rank', ps.low_seed_rank,
    'low_seed_wins', ps.low_seed_wins,
    'winner_entry_id', ps.winner_entry_id,
    'winner_name', wt.name,
    'next_series_id', ps.next_series_id,
    'status', ps.status
  ) order by ps.round_number asc, ps.series_order asc), '[]'::jsonb)
  into series_json
  from public.playoff_series ps
  left join public.team_entries he on he.id = ps.high_seed_entry_id
  left join public.teams ht on ht.id = he.team_id
  left join public.team_entries le on le.id = ps.low_seed_entry_id
  left join public.teams lt on lt.id = le.team_id
  left join public.team_entries we on we.id = ps.winner_entry_id
  left join public.teams wt on wt.id = we.team_id
  where ps.tournament_id = target_tournament;

  return query select
    t_rec.id,
    t_rec.league_id,
    t_rec.division_id,
    t_rec.season_id,
    t_rec.name,
    t_rec.format,
    t_rec.team_count,
    t_rec.status,
    series_json;
end;
$$;

-- RPC: get_division_playoff_bracket
create or replace function public.get_division_playoff_bracket(target_division uuid)
returns table(
  tournament_id uuid,
  league_id uuid,
  division_id uuid,
  season_id uuid,
  name text,
  format text,
  team_count integer,
  status text,
  series jsonb
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  t_id uuid;
begin
  select pt.id into t_id from public.playoff_tournaments pt where pt.division_id = target_division limit 1;
  if t_id is null then
    return;
  end if;
  return query select * from public.get_playoff_bracket(t_id);
end;
$$;

-- RPC: advance_playoff_series_winner
create or replace function public.advance_playoff_series_winner(target_series uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  s_rec public.playoff_series;
  next_rec public.playoff_series;
begin
  select * into s_rec from public.playoff_series where id = target_series;
  if s_rec.id is null or s_rec.winner_entry_id is null or s_rec.next_series_id is null then
    return false;
  end if;

  select * into next_rec from public.playoff_series where id = s_rec.next_series_id;
  if next_rec.id is null then
    return false;
  end if;

  if (s_rec.series_order % 2) = 1 then
    update public.playoff_series
    set high_seed_entry_id = s_rec.winner_entry_id,
        high_seed_rank = coalesce(s_rec.high_seed_rank, 1)
    where id = s_rec.next_series_id;
  else
    update public.playoff_series
    set low_seed_entry_id = s_rec.winner_entry_id,
        low_seed_rank = coalesce(s_rec.low_seed_rank, 2)
    where id = s_rec.next_series_id;
  end if;

  return true;
end;
$$;

revoke all on function public.generate_playoff_bracket(uuid, text, text, integer),
  public.get_playoff_bracket(uuid),
  public.get_division_playoff_bracket(uuid),
  public.advance_playoff_series_winner(uuid) from public, anon, authenticated;

grant execute on function public.generate_playoff_bracket(uuid, text, text, integer),
  public.advance_playoff_series_winner(uuid) to authenticated;

grant execute on function public.get_playoff_bracket(uuid),
  public.get_division_playoff_bracket(uuid) to anon, authenticated;

commit;
