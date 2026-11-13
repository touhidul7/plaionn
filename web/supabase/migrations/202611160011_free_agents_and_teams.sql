begin;

-- ============================================================================
-- Migration: 202611160011_free_agents_and_teams.sql
-- Adds unattached free-agent registration, team vacancy/tryout listings,
-- player applications, and one-click roster placement.
-- ============================================================================

create table public.free_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  player_id uuid not null references public.players(id),
  position text not null check(position in ('F', 'D', 'G', 'any')),
  skill_level text not null default 'Intermediate' check(length(trim(skill_level)) between 1 and 50),
  preferred_division_id uuid references public.divisions(id),
  bio text,
  status text not null default 'seeking' check(status in ('seeking', 'placed', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id, player_id)
);

create table public.team_vacancy_listings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  team_entry_id uuid not null references public.team_entries(id),
  needed_positions text[] not null check(array_length(needed_positions, 1) > 0),
  description text not null check(length(trim(description)) >= 2),
  spots_available integer not null default 1 check(spots_available >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_entry_id)
);

create table public.free_agent_applications (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.team_vacancy_listings(id) on delete cascade,
  player_id uuid not null references public.players(id),
  status text not null default 'pending' check(status in ('pending', 'accepted', 'declined')),
  message text,
  created_at timestamptz not null default now(),
  unique(vacancy_id, player_id)
);

alter table public.free_agent_profiles enable row level security;
alter table public.team_vacancy_listings enable row level security;
alter table public.free_agent_applications enable row level security;

revoke all on public.free_agent_profiles, public.team_vacancy_listings, public.free_agent_applications from anon, authenticated;
grant select on public.free_agent_profiles, public.team_vacancy_listings, public.free_agent_applications to anon, authenticated;
grant insert, update, delete on public.free_agent_profiles, public.team_vacancy_listings, public.free_agent_applications to authenticated;

-- Policies
create policy fa_profiles_read on public.free_agent_profiles for select to anon, authenticated using(true);
create policy fa_profiles_manage on public.free_agent_profiles for all to authenticated
  using(
    public.is_league_commissioner(league_id)
    or exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
  )
  with check(
    public.is_league_commissioner(league_id)
    or exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
  );

create policy team_vacancies_read on public.team_vacancy_listings for select to anon, authenticated using(true);
create policy team_vacancies_manage on public.team_vacancy_listings for all to authenticated
  using(public.is_league_commissioner(league_id))
  with check(public.is_league_commissioner(league_id));

create policy fa_applications_read on public.free_agent_applications for select to anon, authenticated using(true);
create policy fa_applications_manage on public.free_agent_applications for all to authenticated
  using(
    exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
    or exists(select 1 from public.team_vacancy_listings tv where tv.id = vacancy_id and public.is_league_commissioner(tv.league_id))
  )
  with check(
    exists(select 1 from public.players p where p.id = player_id and p.owner_user_id = auth.uid())
    or exists(select 1 from public.team_vacancy_listings tv where tv.id = vacancy_id and public.is_league_commissioner(tv.league_id))
  );

-- RPC: register_free_agent
create or replace function public.register_free_agent(
  target_league uuid,
  target_player uuid,
  target_position text,
  skill text default 'Intermediate',
  pref_division uuid default null,
  agent_bio text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  p_rec public.players;
  profile_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into p_rec from public.players where id = target_player;
  if p_rec.id is null then
    raise exception using errcode='P0002', message='PLAYER_NOT_FOUND';
  end if;

  if not (p_rec.owner_user_id = auth.uid() or public.is_league_commissioner(target_league)) then
    raise exception using errcode='42501', message='Only player or commissioner can register free agent profile';
  end if;

  if target_position not in ('F', 'D', 'G', 'any') then
    raise exception using errcode='22023', message='Position must be F, D, G, or any';
  end if;

  insert into public.free_agent_profiles (
    league_id,
    player_id,
    position,
    skill_level,
    preferred_division_id,
    bio,
    status,
    updated_at
  ) values (
    target_league,
    target_player,
    target_position,
    coalesce(trim(skill), 'Intermediate'),
    pref_division,
    trim(agent_bio),
    'seeking',
    now()
  )
  on conflict (league_id, player_id)
  do update set
    position = excluded.position,
    skill_level = excluded.skill_level,
    preferred_division_id = excluded.preferred_division_id,
    bio = excluded.bio,
    status = 'seeking',
    updated_at = now()
  returning id into profile_id;

  return profile_id;
end;
$$;

-- RPC: post_team_vacancy
create or replace function public.post_team_vacancy(
  target_entry uuid,
  positions_array text[],
  vacancy_desc text,
  open_spots integer default 1
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  te_rec public.team_entries;
  vac_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into te_rec from public.team_entries where id = target_entry;
  if te_rec.id is null then
    raise exception using errcode='P0002', message='TEAM_ENTRY_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(te_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required to post team vacancies';
  end if;

  if coalesce(array_length(positions_array, 1), 0) = 0 then
    raise exception using errcode='22023', message='At least one needed position required';
  end if;

  insert into public.team_vacancy_listings (
    league_id,
    team_entry_id,
    needed_positions,
    description,
    spots_available,
    is_active,
    updated_at
  ) values (
    te_rec.league_id,
    target_entry,
    positions_array,
    trim(vacancy_desc),
    greatest(1, coalesce(open_spots, 1)),
    true,
    now()
  )
  on conflict (team_entry_id)
  do update set
    needed_positions = excluded.needed_positions,
    description = excluded.description,
    spots_available = excluded.spots_available,
    is_active = true,
    updated_at = now()
  returning id into vac_id;

  return vac_id;
end;
$$;

-- RPC: apply_to_vacancy
create or replace function public.apply_to_vacancy(
  target_vacancy uuid,
  target_player uuid,
  app_message text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  vac_rec public.team_vacancy_listings;
  p_rec public.players;
  app_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into vac_rec from public.team_vacancy_listings where id = target_vacancy;
  if vac_rec.id is null or not vac_rec.is_active then
    raise exception using errcode='P0002', message='VACANCY_NOT_AVAILABLE';
  end if;

  select * into p_rec from public.players where id = target_player;
  if p_rec.id is null then
    raise exception using errcode='P0002', message='PLAYER_NOT_FOUND';
  end if;

  if not (p_rec.owner_user_id = auth.uid() or public.is_league_commissioner(vac_rec.league_id)) then
    raise exception using errcode='42501', message='Only player or commissioner can submit application';
  end if;

  insert into public.free_agent_applications (
    vacancy_id,
    player_id,
    status,
    message
  ) values (
    target_vacancy,
    target_player,
    'pending',
    trim(app_message)
  )
  on conflict (vacancy_id, player_id)
  do update set
    status = 'pending',
    message = excluded.message
  returning id into app_id;

  return app_id;
end;
$$;

-- RPC: review_vacancy_application
create or replace function public.review_vacancy_application(
  target_application uuid,
  accept boolean,
  assigned_jersey integer default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  app_rec public.free_agent_applications;
  vac_rec public.team_vacancy_listings;
  next_jersey integer;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into app_rec from public.free_agent_applications where id = target_application;
  if app_rec.id is null then
    raise exception using errcode='P0002', message='APPLICATION_NOT_FOUND';
  end if;

  select * into vac_rec from public.team_vacancy_listings where id = app_rec.vacancy_id;

  if not public.is_league_commissioner(vac_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required to review applications';
  end if;

  if not accept then
    update public.free_agent_applications set status = 'declined' where id = target_application;
    return true;
  end if;

  -- Pick jersey number if not provided
  if assigned_jersey is not null then
    next_jersey := assigned_jersey;
  else
    select coalesce(max(jersey_number) + 1, 10) into next_jersey
    from public.roster_memberships
    where team_entry_id = vac_rec.team_entry_id and status = 'active';
  end if;

  -- Ensure player is in league_players
  insert into public.league_players(league_id, player_id)
  values(vac_rec.league_id, app_rec.player_id)
  on conflict do nothing;

  -- Place player on roster
  insert into public.roster_memberships (
    league_id,
    team_entry_id,
    player_id,
    jersey_number,
    position,
    status
  ) values (
    vac_rec.league_id,
    vac_rec.team_entry_id,
    app_rec.player_id,
    next_jersey,
    'F',
    'active'
  )
  on conflict (team_entry_id, player_id)
  do update set
    jersey_number = excluded.jersey_number,
    status = 'active',
    revision = public.roster_memberships.revision + 1;

  -- Update application and free agent profile status
  update public.free_agent_applications set status = 'accepted' where id = target_application;
  update public.free_agent_profiles set status = 'placed', updated_at = now()
  where league_id = vac_rec.league_id and player_id = app_rec.player_id;

  -- Decrement spots
  update public.team_vacancy_listings
  set spots_available = greatest(0, spots_available - 1),
      is_active = (spots_available - 1 > 0)
  where id = vac_rec.id;

  return true;
end;
$$;

-- RPC: list_free_agents
create or replace function public.list_free_agents(target_league uuid)
returns table(
  profile_id uuid,
  player_id uuid,
  player_name text,
  preferred_position text,
  skill_level text,
  preferred_division_name text,
  bio text,
  status text,
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
    fap.id as profile_id,
    fap.player_id,
    p.display_name as player_name,
    fap.position as preferred_position,
    fap.skill_level,
    d.name as preferred_division_name,
    fap.bio,
    fap.status,
    fap.created_at
  from public.free_agent_profiles fap
  join public.players p on p.id = fap.player_id
  left join public.divisions d on d.id = fap.preferred_division_id
  where fap.league_id = target_league
  order by
    case when fap.status = 'seeking' then 0 else 1 end,
    fap.created_at desc;
end;
$$;

-- RPC: list_team_vacancies
create or replace function public.list_team_vacancies(target_league uuid)
returns table(
  vacancy_id uuid,
  team_entry_id uuid,
  team_name text,
  division_name text,
  needed_positions text[],
  description text,
  spots_available integer,
  is_active boolean,
  applicant_count bigint,
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
    tv.id as vacancy_id,
    tv.team_entry_id,
    t.name as team_name,
    d.name as division_name,
    tv.needed_positions,
    tv.description,
    tv.spots_available,
    tv.is_active,
    count(fa.id) as applicant_count,
    tv.created_at
  from public.team_vacancy_listings tv
  join public.team_entries te on te.id = tv.team_entry_id
  join public.teams t on t.id = te.team_id
  join public.divisions d on d.id = te.division_id
  left join public.free_agent_applications fa on fa.vacancy_id = tv.id and fa.status = 'pending'
  where tv.league_id = target_league and tv.is_active = true
  group by tv.id, tv.team_entry_id, t.name, d.name, tv.needed_positions, tv.description, tv.spots_available, tv.is_active, tv.created_at
  order by tv.created_at desc;
end;
$$;

revoke all on function public.register_free_agent(uuid, uuid, text, text, uuid, text),
  public.post_team_vacancy(uuid, text[], text, integer),
  public.apply_to_vacancy(uuid, uuid, text),
  public.review_vacancy_application(uuid, boolean, integer),
  public.list_free_agents(uuid),
  public.list_team_vacancies(uuid) from public, anon, authenticated;

grant execute on function public.register_free_agent(uuid, uuid, text, text, uuid, text),
  public.post_team_vacancy(uuid, text[], text, integer),
  public.apply_to_vacancy(uuid, uuid, text),
  public.review_vacancy_application(uuid, boolean, integer) to authenticated;

grant execute on function public.list_free_agents(uuid),
  public.list_team_vacancies(uuid) to anon, authenticated;

commit;
