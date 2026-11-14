-- ============================================================================
-- Migration: 202611160014_awards_and_game_stars.sql
-- Description: Game Three Stars of the Game (1st, 2nd, 3rd Star selection),
--              Season Awards & Honors (MVP, Top Scorer, Goaltender, Defenseman),
--              and player milestone recognition.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Game Three Stars
-- ----------------------------------------------------------------------------
create table if not exists public.game_stars (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  star_number integer not null check (star_number in (1, 2, 3)),
  player_id uuid not null references public.players(id) on delete cascade,
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  headline text,
  selected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (game_id, star_number),
  unique (game_id, player_id)
);

create index if not exists idx_game_stars_player on public.game_stars(player_id);
create index if not exists idx_game_stars_game on public.game_stars(game_id);

alter table public.game_stars enable row level security;

drop policy if exists game_stars_select_all on public.game_stars;
create policy game_stars_select_all on public.game_stars
  for select using (true);

drop policy if exists game_stars_manage_authorized on public.game_stars;
create policy game_stars_manage_authorized on public.game_stars
  for all using (
    auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = game_stars.league_id and lm.role in ('commissioner', 'referee', 'timekeeper')
    )
    or auth.uid() in (
      select go.user_id from public.game_officials go
      where go.game_id = game_stars.game_id
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Season Awards & Honors
-- ----------------------------------------------------------------------------
create table if not exists public.season_awards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete cascade,
  award_code text not null check (
    award_code in (
      'MVP',
      'TOP_SCORER',
      'BEST_DEFENSEMAN',
      'BEST_GOALTENDER',
      'SPORTSMANSHIP',
      'PLAYOFF_MVP',
      'ROOKIE_OF_YEAR',
      'COACH_OF_YEAR'
    )
  ),
  title text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  citation text,
  awarded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, division_id, award_code)
);

create index if not exists idx_season_awards_lookup
  on public.season_awards(league_id, season_id, division_id);

alter table public.season_awards enable row level security;

drop policy if exists season_awards_select_all on public.season_awards;
create policy season_awards_select_all on public.season_awards
  for select using (true);

drop policy if exists season_awards_manage_commissioner on public.season_awards;
create policy season_awards_manage_commissioner on public.season_awards
  for all using (
    auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = season_awards.league_id and lm.role = 'commissioner'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Game Stars RPCs
-- ----------------------------------------------------------------------------

create or replace function public.set_game_stars(
  target_game uuid,
  stars jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
  v_game_status text;
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
  v_item jsonb;
  v_star integer;
  v_player_id uuid;
  v_entry_id uuid;
  v_headline text;
  v_count integer := 0;
begin
  select g.league_id, g.status into v_league_id, v_game_status
  from public.games g
  where g.id = target_game;

  if not found then
    raise exception 'Game % not found', target_game;
  end if;

  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = v_league_id and lm.user_id = v_caller and lm.role in ('commissioner', 'referee', 'timekeeper');

    if not coalesce(v_can_manage, false) then
      select true into v_can_manage
      from public.game_officials go
      where go.game_id = target_game and go.user_id = v_caller;
    end if;
  end if;

  if v_caller is not null and not coalesce(v_can_manage, false) then
    raise exception 'Permission denied: only game officials or commissioners may select stars of the game';
  end if;

  -- Clear existing stars for this game
  delete from public.game_stars where game_id = target_game;

  -- Process stars JSON array: [{ star_number: 1, player_id: uuid, team_entry_id: uuid, headline: text }]
  for v_item in select * from jsonb_array_elements(stars)
  loop
    v_star := (v_item->>'star_number')::integer;
    v_player_id := (v_item->>'player_id')::uuid;
    v_entry_id := (v_item->>'team_entry_id')::uuid;
    v_headline := v_item->>'headline';

    if v_star is null or v_player_id is null or v_entry_id is null then
      continue;
    end if;

    if v_star not in (1, 2, 3) then
      raise exception 'Invalid star number %; must be 1, 2, or 3', v_star;
    end if;

    insert into public.game_stars (
      league_id,
      game_id,
      star_number,
      player_id,
      team_entry_id,
      headline,
      selected_by
    )
    values (
      v_league_id,
      target_game,
      v_star,
      v_player_id,
      v_entry_id,
      v_headline,
      v_caller
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.get_game_stars(
  target_game uuid
)
returns table (
  star_number integer,
  player_id uuid,
  display_name text,
  jersey_number integer,
  team_name text,
  headline text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    gs.star_number,
    p.id as player_id,
    p.display_name,
    rm.jersey_number,
    t.name as team_name,
    gs.headline
  from public.game_stars gs
  join public.players p on p.id = gs.player_id
  join public.team_entries te on te.id = gs.team_entry_id
  join public.teams t on t.id = te.team_id
  left join public.roster_memberships rm on rm.player_id = p.id and rm.team_entry_id = gs.team_entry_id
  where gs.game_id = target_game
  order by gs.star_number asc;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Season Awards RPCs
-- ----------------------------------------------------------------------------

create or replace function public.assign_season_award(
  target_season uuid,
  target_division uuid,
  target_award_code text,
  target_award_title text,
  target_player uuid,
  target_entry uuid,
  citation_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
  v_res_id uuid;
begin
  select s.league_id into v_league_id
  from public.seasons s
  where s.id = target_season;

  if not found then
    raise exception 'Season % not found', target_season;
  end if;

  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = v_league_id and lm.user_id = v_caller and lm.role = 'commissioner';

    if not coalesce(v_can_manage, false) then
      raise exception 'Permission denied: only commissioners may assign season honors';
    end if;
  end if;

  insert into public.season_awards (
    league_id,
    season_id,
    division_id,
    award_code,
    title,
    player_id,
    team_entry_id,
    citation,
    awarded_by
  )
  values (
    v_league_id,
    target_season,
    target_division,
    target_award_code,
    target_award_title,
    target_player,
    target_entry,
    citation_text,
    v_caller
  )
  on conflict (season_id, division_id, award_code)
  do update set
    title = excluded.title,
    player_id = excluded.player_id,
    team_entry_id = excluded.team_entry_id,
    citation = excluded.citation,
    awarded_by = excluded.awarded_by
  returning id into v_res_id;

  return v_res_id;
end;
$$;

create or replace function public.get_season_awards(
  target_season uuid,
  target_division uuid default null
)
returns table (
  award_id uuid,
  code text,
  award_title text,
  player_id uuid,
  display_name text,
  jersey_number integer,
  team_name text,
  division_name text,
  citation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    sa.id as award_id,
    sa.award_code as code,
    sa.title as award_title,
    p.id as player_id,
    p.display_name,
    rm.jersey_number,
    t.name as team_name,
    coalesce(d.name, 'All Divisions') as division_name,
    sa.citation
  from public.season_awards sa
  join public.players p on p.id = sa.player_id
  join public.team_entries te on te.id = sa.team_entry_id
  join public.teams t on t.id = te.team_id
  left join public.divisions d on d.id = sa.division_id
  left join public.roster_memberships rm on rm.player_id = p.id and rm.team_entry_id = sa.team_entry_id
  where sa.season_id = target_season
    and (target_division is null or sa.division_id is null or sa.division_id = target_division)
  order by
    case sa.award_code
      when 'MVP' then 1
      when 'TOP_SCORER' then 2
      when 'BEST_DEFENSEMAN' then 3
      when 'BEST_GOALTENDER' then 4
      when 'PLAYOFF_MVP' then 5
      when 'SPORTSMANSHIP' then 6
      else 7
    end;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Grants
-- ----------------------------------------------------------------------------
grant select on public.game_stars to anon, authenticated;
grant all on public.game_stars to authenticated;

grant select on public.season_awards to anon, authenticated;
grant all on public.season_awards to authenticated;

revoke execute on function public.set_game_stars(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_game_stars(uuid, jsonb) to authenticated;

revoke execute on function public.get_game_stars(uuid) from public, anon, authenticated;
grant execute on function public.get_game_stars(uuid) to anon, authenticated;

revoke execute on function public.assign_season_award(uuid, uuid, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_season_award(uuid, uuid, text, text, uuid, uuid, text) to authenticated;

revoke execute on function public.get_season_awards(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_season_awards(uuid, uuid) to anon, authenticated;

commit;
