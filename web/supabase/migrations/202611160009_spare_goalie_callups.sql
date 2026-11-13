begin;

-- ============================================================================
-- Migration: 202611160009_spare_goalie_callups.sql
-- Adds spare player & goalie pool discovery, game day call-up requests,
-- player acceptance/declination, and eligibility validation.
-- ============================================================================

create table public.spare_player_pool (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  player_id uuid not null references public.players(id),
  preferred_position text not null check(preferred_position in ('F', 'D', 'G', 'any')),
  skill_level text not null default 'Intermediate' check(length(trim(skill_level)) between 1 and 50),
  is_available boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id, player_id)
);

create table public.game_spare_callups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  game_id uuid not null references public.games(id),
  team_entry_id uuid not null references public.team_entries(id),
  player_id uuid not null references public.players(id),
  position text not null check(position in ('F', 'D', 'G')),
  jersey_number integer check(jersey_number between 0 and 99),
  status text not null default 'requested' check(status in ('requested', 'accepted', 'declined', 'cancelled')),
  requested_by uuid references auth.users(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id, player_id)
);

alter table public.spare_player_pool enable row level security;
alter table public.game_spare_callups enable row level security;

revoke all on public.spare_player_pool, public.game_spare_callups from anon, authenticated;
grant select on public.spare_player_pool, public.game_spare_callups to anon, authenticated;
grant insert, update, delete on public.spare_player_pool, public.game_spare_callups to authenticated;

-- Policies: spare_player_pool
create policy spare_pool_read on public.spare_player_pool for select to anon, authenticated using(true);

create policy spare_pool_manage on public.spare_player_pool for all to authenticated
  using(
    public.is_league_commissioner(league_id) or
    exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
  )
  with check(
    public.is_league_commissioner(league_id) or
    exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
  );

-- Policies: game_spare_callups
create policy spare_callups_read on public.game_spare_callups for select to anon, authenticated using(true);

create policy spare_callups_manage on public.game_spare_callups for all to authenticated
  using(
    public.is_league_commissioner(league_id) or
    exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
  )
  with check(
    public.is_league_commissioner(league_id) or
    exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
  );

-- RPC: register_spare_availability
create or replace function public.register_spare_availability(
  target_league uuid,
  target_player uuid,
  target_position text,
  skill text default 'Intermediate',
  available boolean default true,
  spare_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  pool_id uuid;
  p_rec public.players;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into p_rec from public.players where id = target_player;
  if p_rec.id is null then
    raise exception using errcode='P0002', message='PLAYER_NOT_FOUND';
  end if;

  if not (p_rec.owner_user_id = auth.uid() or public.is_league_commissioner(target_league)) then
    raise exception using errcode='42501', message='Only the player or commissioner can manage spare availability';
  end if;

  if target_position not in ('F', 'D', 'G', 'any') then
    raise exception using errcode='22023', message='Invalid position (must be F, D, G, or any)';
  end if;

  insert into public.spare_player_pool (
    league_id,
    player_id,
    preferred_position,
    skill_level,
    is_available,
    notes,
    updated_at
  ) values (
    target_league,
    target_player,
    target_position,
    coalesce(trim(skill), 'Intermediate'),
    available,
    trim(spare_notes),
    now()
  )
  on conflict (league_id, player_id)
  do update set
    preferred_position = excluded.preferred_position,
    skill_level = excluded.skill_level,
    is_available = excluded.is_available,
    notes = excluded.notes,
    updated_at = now()
  returning id into pool_id;

  return pool_id;
end;
$$;

-- RPC: list_available_spares
create or replace function public.list_available_spares(
  target_league uuid,
  target_position text default 'all'
)
returns table(
  pool_id uuid,
  player_id uuid,
  player_name text,
  preferred_position text,
  skill_level text,
  is_available boolean,
  notes text,
  is_suspended boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return query
  select
    spp.id as pool_id,
    spp.player_id,
    p.display_name as player_name,
    spp.preferred_position,
    spp.skill_level,
    spp.is_available,
    spp.notes,
    public.is_player_suspended(spp.player_id) as is_suspended
  from public.spare_player_pool spp
  join public.players p on p.id = spp.player_id
  where spp.league_id = target_league
    and spp.is_available = true
    and (target_position = 'all' or spp.preferred_position = target_position or spp.preferred_position = 'any')
  order by
    case when spp.preferred_position = 'G' then 0 else 1 end,
    p.display_name asc;
end;
$$;

-- RPC: request_game_callup
create or replace function public.request_game_callup(
  target_game uuid,
  target_entry uuid,
  target_player uuid,
  target_position text,
  jersey_num integer default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  game_rec public.games;
  callup_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into game_rec from public.games where id = target_game;
  if game_rec.id is null then
    raise exception using errcode='P0002', message='GAME_NOT_FOUND';
  end if;

  -- Ensure target_entry is playing in this game
  if game_rec.home_entry_id <> target_entry and game_rec.away_entry_id <> target_entry then
    raise exception using errcode='22023', message='Team is not scheduled for this game';
  end if;

  -- Check if commissioner
  if not public.is_league_commissioner(game_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required to dispatch call-ups';
  end if;

  -- Verify player is not suspended
  if public.is_player_suspended(target_player) then
    raise exception using errcode='22023', message='Cannot call up a suspended player';
  end if;

  if target_position not in ('F', 'D', 'G') then
    raise exception using errcode='22023', message='Position must be F, D, or G';
  end if;

  insert into public.game_spare_callups (
    league_id,
    game_id,
    team_entry_id,
    player_id,
    position,
    jersey_number,
    status,
    requested_by
  ) values (
    game_rec.league_id,
    target_game,
    target_entry,
    target_player,
    target_position,
    jersey_num,
    'requested',
    auth.uid()
  )
  on conflict (game_id, player_id)
  do update set
    team_entry_id = excluded.team_entry_id,
    position = excluded.position,
    jersey_number = excluded.jersey_number,
    status = 'requested',
    updated_at = now()
  returning id into callup_id;

  return callup_id;
end;
$$;

-- RPC: respond_to_callup
create or replace function public.respond_to_callup(
  target_callup uuid,
  accept boolean
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  callup_rec public.game_spare_callups;
  p_rec public.players;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into callup_rec from public.game_spare_callups where id = target_callup;
  if callup_rec.id is null then
    raise exception using errcode='P0002', message='CALLUP_NOT_FOUND';
  end if;

  select * into p_rec from public.players where id = callup_rec.player_id;

  -- Caller must be the player or commissioner
  if not (p_rec.owner_user_id = auth.uid() or public.is_league_commissioner(callup_rec.league_id)) then
    raise exception using errcode='42501', message='Only the invited player or commissioner can respond';
  end if;

  update public.game_spare_callups
  set status = case when accept then 'accepted' else 'declined' end,
      responded_at = now(),
      updated_at = now()
  where id = target_callup;

  return true;
end;
$$;

-- RPC: list_game_callups
create or replace function public.list_game_callups(target_game uuid)
returns table(
  callup_id uuid,
  game_id uuid,
  team_entry_id uuid,
  team_name text,
  player_id uuid,
  player_name text,
  player_position text,
  jersey_number integer,
  status text,
  responded_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return query
  select
    gsc.id as callup_id,
    gsc.game_id,
    gsc.team_entry_id,
    t.name as team_name,
    gsc.player_id,
    p.display_name as player_name,
    gsc.position as player_position,
    gsc.jersey_number,
    gsc.status,
    gsc.responded_at,
    gsc.created_at
  from public.game_spare_callups gsc
  join public.players p on p.id = gsc.player_id
  join public.team_entries te on te.id = gsc.team_entry_id
  join public.teams t on t.id = te.team_id
  where gsc.game_id = target_game
  order by gsc.created_at desc;
end;
$$;

revoke all on function public.register_spare_availability(uuid, uuid, text, text, boolean, text),
  public.list_available_spares(uuid, text),
  public.request_game_callup(uuid, uuid, uuid, text, integer),
  public.respond_to_callup(uuid, boolean),
  public.list_game_callups(uuid) from public, anon, authenticated;

grant execute on function public.register_spare_availability(uuid, uuid, text, text, boolean, text),
  public.request_game_callup(uuid, uuid, uuid, text, integer),
  public.respond_to_callup(uuid, boolean) to authenticated;

grant execute on function public.list_available_spares(uuid, text),
  public.list_game_callups(uuid) to anon, authenticated;

commit;
