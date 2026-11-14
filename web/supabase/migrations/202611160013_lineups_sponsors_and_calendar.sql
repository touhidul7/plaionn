-- ============================================================================
-- Migration: 202611160013_lineups_sponsors_and_calendar.sql
-- Description: Team Lineup Builder (Forward lines, D-pairs, starting goalie),
--              suspension eligibility enforcement, and League Sponsor Placements.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Game Lineups Table
-- ----------------------------------------------------------------------------
create table if not exists public.game_lineups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  team_entry_id uuid not null references public.team_entries(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  line_assignment text not null check (
    line_assignment in (
      'F1_LW', 'F1_C', 'F1_RW',
      'F2_LW', 'F2_C', 'F2_RW',
      'F3_LW', 'F3_C', 'F3_RW',
      'D1_LD', 'D1_RD',
      'D2_LD', 'D2_RD',
      'D3_LD', 'D3_RD',
      'G_STARTER', 'G_BACKUP',
      'SCRATCH'
    )
  ),
  jersey_number integer check (jersey_number is null or (jersey_number >= 0 and jersey_number <= 99)),
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, team_entry_id, player_id)
);

create unique index if not exists idx_unique_game_line_slot
  on public.game_lineups(game_id, team_entry_id, line_assignment)
  where line_assignment <> 'SCRATCH';

create index if not exists idx_game_lineups_game_entry
  on public.game_lineups(game_id, team_entry_id);

alter table public.game_lineups enable row level security;

-- ----------------------------------------------------------------------------
-- 2. League Sponsors Table
-- ----------------------------------------------------------------------------
create table if not exists public.league_sponsors (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null,
  logo_url text,
  website_url text,
  placement_tier text not null default 'partner_card' check (
    placement_tier in ('primary_banner', 'partner_card', 'scoreboard_sponsor')
  ),
  tagline text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_league_sponsors_tier
  on public.league_sponsors(league_id, is_active, display_order);

alter table public.league_sponsors enable row level security;

-- RLS for sponsors: public can view active, commissioner can manage
drop policy if exists league_sponsors_read_public on public.league_sponsors;
create policy league_sponsors_read_public on public.league_sponsors
  for select using (is_active = true or auth.uid() in (
    select lm.user_id from public.league_memberships lm
    where lm.league_id = league_sponsors.league_id and lm.role = 'commissioner'
  ));

drop policy if exists league_sponsors_commissioner_all on public.league_sponsors;
create policy league_sponsors_commissioner_all on public.league_sponsors
  for all using (auth.uid() in (
    select lm.user_id from public.league_memberships lm
    where lm.league_id = league_sponsors.league_id and lm.role = 'commissioner'
  ));

-- RLS for game_lineups: public can view lineups, captains/commissioners can manage
drop policy if exists game_lineups_select_public on public.game_lineups;
create policy game_lineups_select_public on public.game_lineups
  for select using (true);

drop policy if exists game_lineups_manage_authorized on public.game_lineups;
create policy game_lineups_manage_authorized on public.game_lineups
  for all using (
    auth.uid() in (
      select lm.user_id from public.league_memberships lm
      where lm.league_id = game_lineups.league_id and lm.role in ('commissioner', 'captain')
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Lineup Management RPCs
-- ----------------------------------------------------------------------------

create or replace function public.save_game_lineup(
  target_game uuid,
  target_entry uuid,
  assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
  v_game_status text;
  v_item jsonb;
  v_player_id uuid;
  v_line_slot text;
  v_jersey integer;
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
  v_is_suspended boolean := false;
  v_count integer := 0;
begin
  select g.league_id, g.status into v_league_id, v_game_status
  from public.games g
  where g.id = target_game
    and (g.home_entry_id = target_entry or g.away_entry_id = target_entry);

  if not found then
    raise exception 'Game % not found or entry % is not a participant', target_game, target_entry;
  end if;

  if v_game_status = 'cancelled' then
    raise exception 'Cannot modify lineup for a cancelled game';
  end if;

  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = v_league_id and lm.user_id = v_caller and lm.role in ('commissioner', 'captain');
  end if;

  if v_caller is not null and not coalesce(v_can_manage, false) then
    raise exception 'Permission denied: only team captains or league commissioners may submit lineups';
  end if;

  for v_item in select * from jsonb_array_elements(assignments)
  loop
    v_player_id := (v_item->>'player_id')::uuid;
    v_line_slot := v_item->>'line_assignment';
    v_jersey := (v_item->>'jersey_number')::integer;

    if v_player_id is null or v_line_slot is null then
      continue;
    end if;

    -- Validate player is on team roster or approved spare
    if not exists (
      select 1 from public.roster_memberships rm
      where rm.team_entry_id = target_entry and rm.player_id = v_player_id
    ) then
      begin
        if not exists (
          select 1 from public.spare_callups sc
          where sc.game_id = target_game and sc.team_entry_id = target_entry
            and sc.player_id = v_player_id and sc.status = 'accepted'
        ) then
          raise exception 'Player % is not registered on roster for entry %', v_player_id, target_entry;
        end if;
      exception when undefined_table then
        raise exception 'Player % is not registered on roster for entry %', v_player_id, target_entry;
      end;
    end if;

    begin
      select public.is_player_suspended(v_player_id, target_game) into v_is_suspended;
    exception when undefined_function then
      v_is_suspended := false;
    end;

    if coalesce(v_is_suspended, false) and v_line_slot <> 'SCRATCH' then
      raise exception 'Player % is currently suspended and ineligible for the lineup', v_player_id;
    end if;

    insert into public.game_lineups (
      league_id,
      game_id,
      team_entry_id,
      player_id,
      line_assignment,
      jersey_number,
      submitted_by,
      updated_at
    )
    values (
      v_league_id,
      target_game,
      target_entry,
      v_player_id,
      v_line_slot,
      v_jersey,
      v_caller,
      now()
    )
    on conflict (game_id, team_entry_id, player_id)
    do update set
      line_assignment = excluded.line_assignment,
      jersey_number = coalesce(excluded.jersey_number, public.game_lineups.jersey_number),
      submitted_by = excluded.submitted_by,
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.get_game_lineup(
  target_game uuid,
  target_entry uuid
)
returns table (
  player_id uuid,
  display_name text,
  jersey_number integer,
  line_assignment text,
  player_position text,
  rsvp_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    p.id as player_id,
    p.display_name,
    coalesce(gl.jersey_number, rm.jersey_number) as jersey_number,
    coalesce(gl.line_assignment, 'SCRATCH') as line_assignment,
    coalesce(rm.position, 'F') as player_position,
    coalesce(ga.status, 'unconfirmed') as rsvp_status
  from public.players p
  join public.roster_memberships rm on rm.player_id = p.id and rm.team_entry_id = target_entry
  left join public.game_lineups gl on gl.player_id = p.id and gl.game_id = target_game and gl.team_entry_id = target_entry
  left join public.game_attendance ga on ga.player_id = p.id and ga.game_id = target_game
  order by
    case
      when gl.line_assignment like 'G_%' then 1
      when gl.line_assignment like 'F1_%' then 2
      when gl.line_assignment like 'D1_%' then 3
      when gl.line_assignment like 'F2_%' then 4
      when gl.line_assignment like 'D2_%' then 5
      when gl.line_assignment like 'F3_%' then 6
      when gl.line_assignment like 'D3_%' then 7
      when gl.line_assignment = 'SCRATCH' then 8
      else 9
    end,
    coalesce(gl.jersey_number, rm.jersey_number, 999);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. League Sponsors RPCs
-- ----------------------------------------------------------------------------

create or replace function public.get_active_league_sponsors(
  target_league uuid
)
returns table (
  sponsor_id uuid,
  name text,
  logo_url text,
  website_url text,
  placement_tier text,
  tagline text,
  display_order integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    s.id as sponsor_id,
    s.name,
    s.logo_url,
    s.website_url,
    s.placement_tier,
    s.tagline,
    s.display_order
  from public.league_sponsors s
  where s.league_id = target_league
    and s.is_active = true
  order by s.display_order asc, s.created_at asc;
end;
$$;

create or replace function public.upsert_league_sponsor(
  target_league uuid,
  sponsor_id uuid,
  sponsor_name text,
  sponsor_logo text,
  sponsor_url text,
  sponsor_tier text,
  sponsor_tagline text,
  sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
  v_res_id uuid;
begin
  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = target_league and lm.user_id = v_caller and lm.role = 'commissioner';

    if not coalesce(v_can_manage, false) then
      raise exception 'Permission denied: only commissioners may configure sponsors';
    end if;
  end if;

  if sponsor_id is not null then
    update public.league_sponsors set
      name = sponsor_name,
      logo_url = sponsor_logo,
      website_url = sponsor_url,
      placement_tier = sponsor_tier,
      tagline = sponsor_tagline,
      display_order = sort_order
    where id = sponsor_id and league_id = target_league
    returning id into v_res_id;
  else
    insert into public.league_sponsors (
      league_id, name, logo_url, website_url, placement_tier, tagline, display_order, is_active
    ) values (
      target_league, sponsor_name, sponsor_logo, sponsor_url, sponsor_tier, sponsor_tagline, sort_order, true
    )
    returning id into v_res_id;
  end if;

  return v_res_id;
end;
$$;

create or replace function public.delete_league_sponsor(
  target_league uuid,
  target_sponsor uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_can_manage boolean := false;
begin
  if v_caller is not null then
    select true into v_can_manage
    from public.league_memberships lm
    where lm.league_id = target_league and lm.user_id = v_caller and lm.role = 'commissioner';

    if not coalesce(v_can_manage, false) then
      raise exception 'Permission denied: only commissioners may delete sponsors';
    end if;
  end if;

  delete from public.league_sponsors
  where id = target_sponsor and league_id = target_league;

  return found;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Grants
-- ----------------------------------------------------------------------------
grant select on public.game_lineups to anon, authenticated;
grant all on public.game_lineups to authenticated;

grant select on public.league_sponsors to anon, authenticated;
grant all on public.league_sponsors to authenticated;

revoke execute on function public.save_game_lineup(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_game_lineup(uuid, uuid, jsonb) to authenticated;

revoke execute on function public.get_game_lineup(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_game_lineup(uuid, uuid) to anon, authenticated;

revoke execute on function public.get_active_league_sponsors(uuid) from public, anon, authenticated;
grant execute on function public.get_active_league_sponsors(uuid) to anon, authenticated;

revoke execute on function public.upsert_league_sponsor(uuid, uuid, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.upsert_league_sponsor(uuid, uuid, text, text, text, text, text, integer) to authenticated;

revoke execute on function public.delete_league_sponsor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_league_sponsor(uuid, uuid) to authenticated;

commit;
