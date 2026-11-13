begin;

-- ============================================================================
-- Migration: 202611160008_discipline_and_suspensions.sql
-- Adds disciplinary incident tracking, game misconduct suspensions,
-- captain/player appeals, and player eligibility enforcement.
-- ============================================================================

create table public.disciplinary_incidents (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null references public.seasons(id),
  game_id uuid references public.games(id),
  player_id uuid not null references public.players(id),
  team_entry_id uuid not null references public.team_entries(id),
  infraction text not null check(length(trim(infraction)) between 2 and 120),
  penalty_minutes integer not null default 0 check(penalty_minutes >= 0),
  games_suspended integer not null default 1 check(games_suspended >= 0),
  games_served integer not null default 0 check(games_served >= 0),
  status text not null default 'active' check(status in ('active', 'served', 'appealed', 'revoked')),
  incident_date date not null default current_date,
  notes text,
  appeal_notes text,
  appeal_status text check(appeal_status in ('pending', 'upheld', 'reduced', 'overturned')),
  appeal_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disciplinary_incidents enable row level security;

revoke all on public.disciplinary_incidents from anon, authenticated;
grant select on public.disciplinary_incidents to anon, authenticated;
grant insert, update, delete on public.disciplinary_incidents to authenticated;

-- Policies
create policy disciplinary_incidents_read on public.disciplinary_incidents
  for select to anon, authenticated using(true);

create policy disciplinary_incidents_manage on public.disciplinary_incidents
  for all to authenticated
  using(public.is_league_commissioner(league_id))
  with check(public.is_league_commissioner(league_id));

create policy disciplinary_incidents_appeal on public.disciplinary_incidents
  for update to authenticated
  using(
    exists(
      select 1 from public.players p
      where p.id = player_id and p.owner_user_id = auth.uid()
    )
  )
  with check(
    exists(
      select 1 from public.players p
      where p.id = player_id and p.owner_user_id = auth.uid()
    )
  );

-- RPC: record_disciplinary_incident
create or replace function public.record_disciplinary_incident(
  target_league uuid,
  target_season uuid,
  target_player uuid,
  target_entry uuid,
  infraction_name text,
  suspended_games integer,
  penalty_mins integer default 0,
  target_game uuid default null,
  incident_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  incident_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if trim(infraction_name) = '' then
    raise exception using errcode='22023', message='Infraction description required';
  end if;

  if suspended_games < 0 then
    raise exception using errcode='22023', message='Suspended games cannot be negative';
  end if;

  insert into public.disciplinary_incidents (
    league_id,
    season_id,
    game_id,
    player_id,
    team_entry_id,
    infraction,
    games_suspended,
    penalty_minutes,
    notes,
    status
  ) values (
    target_league,
    target_season,
    target_game,
    target_player,
    target_entry,
    trim(infraction_name),
    suspended_games,
    coalesce(penalty_mins, 0),
    trim(incident_notes),
    case when suspended_games = 0 then 'served' else 'active' end
  )
  returning id into incident_id;

  return incident_id;
end;
$$;

-- RPC: submit_suspension_appeal
create or replace function public.submit_suspension_appeal(
  target_incident uuid,
  statement text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inc_rec public.disciplinary_incidents;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into inc_rec from public.disciplinary_incidents where id = target_incident;
  if inc_rec.id is null then
    raise exception using errcode='P0002', message='INCIDENT_NOT_FOUND';
  end if;

  -- Verify caller is the suspended player or commissioner
  if not (
    exists(select 1 from public.players p where p.id = inc_rec.player_id and p.owner_user_id = auth.uid())
    or public.is_league_commissioner(inc_rec.league_id)
  ) then
    raise exception using errcode='42501', message='Only the suspended player or commissioner may appeal';
  end if;

  if inc_rec.status not in ('active', 'appealed') then
    raise exception using errcode='22023', message='Only active suspensions can be appealed';
  end if;

  update public.disciplinary_incidents
  set status = 'appealed',
      appeal_notes = trim(statement),
      appeal_status = 'pending',
      appeal_submitted_at = now(),
      updated_at = now()
  where id = target_incident;

  return true;
end;
$$;

-- RPC: resolve_suspension_appeal
create or replace function public.resolve_suspension_appeal(
  target_incident uuid,
  decision text,
  new_suspended_games integer default null,
  commissioner_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inc_rec public.disciplinary_incidents;
  final_games integer;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into inc_rec from public.disciplinary_incidents where id = target_incident;
  if inc_rec.id is null then
    raise exception using errcode='P0002', message='INCIDENT_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(inc_rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if decision not in ('upheld', 'reduced', 'overturned') then
    raise exception using errcode='22023', message='Invalid appeal decision';
  end if;

  if decision = 'overturned' then
    update public.disciplinary_incidents
    set status = 'revoked',
        appeal_status = 'overturned',
        notes = coalesce(notes || ' | ', '') || 'Appeal Overturned: ' || coalesce(commissioner_notes, 'Suspension rescinded'),
        updated_at = now()
    where id = target_incident;
  elsif decision = 'reduced' then
    if new_suspended_games is null or new_suspended_games < 0 then
      raise exception using errcode='22023', message='Valid reduced game count required';
    end if;

    final_games := new_suspended_games;
    update public.disciplinary_incidents
    set games_suspended = final_games,
        appeal_status = 'reduced',
        status = case when inc_rec.games_served >= final_games then 'served' else 'active' end,
        notes = coalesce(notes || ' | ', '') || 'Appeal Reduced: ' || coalesce(commissioner_notes, 'Suspension reduced to ' || final_games || ' games'),
        updated_at = now()
    where id = target_incident;
  else -- upheld
    update public.disciplinary_incidents
    set appeal_status = 'upheld',
        status = 'active',
        notes = coalesce(notes || ' | ', '') || 'Appeal Upheld: ' || coalesce(commissioner_notes, 'Suspension maintained'),
        updated_at = now()
    where id = target_incident;
  end if;

  return true;
end;
$$;

-- RPC: list_league_discipline
create or replace function public.list_league_discipline(target_league uuid)
returns table(
  incident_id uuid,
  league_id uuid,
  season_id uuid,
  game_id uuid,
  player_id uuid,
  player_name text,
  jersey_number integer,
  team_entry_id uuid,
  team_name text,
  infraction text,
  penalty_minutes integer,
  games_suspended integer,
  games_served integer,
  games_remaining integer,
  status text,
  incident_date date,
  notes text,
  appeal_notes text,
  appeal_status text,
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
    di.id as incident_id,
    di.league_id,
    di.season_id,
    di.game_id,
    di.player_id,
    p.display_name as player_name,
    rm.jersey_number,
    di.team_entry_id,
    t.name as team_name,
    di.infraction,
    di.penalty_minutes,
    di.games_suspended,
    di.games_served,
    greatest(0, di.games_suspended - di.games_served) as games_remaining,
    di.status,
    di.incident_date,
    di.notes,
    di.appeal_notes,
    di.appeal_status,
    di.created_at
  from public.disciplinary_incidents di
  join public.players p on p.id = di.player_id
  join public.team_entries te on te.id = di.team_entry_id
  join public.teams t on t.id = te.team_id
  left join public.roster_memberships rm on rm.player_id = di.player_id and rm.team_entry_id = di.team_entry_id and rm.status = 'active'
  where di.league_id = target_league
  order by di.created_at desc;
end;
$$;

-- RPC: is_player_suspended
create or replace function public.is_player_suspended(target_player uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  return exists(
    select 1
    from public.disciplinary_incidents
    where player_id = target_player
      and status in ('active', 'appealed')
      and games_served < games_suspended
  );
end;
$$;

revoke all on function public.record_disciplinary_incident(uuid, uuid, uuid, uuid, text, integer, integer, uuid, text),
  public.submit_suspension_appeal(uuid, text),
  public.resolve_suspension_appeal(uuid, text, integer, text),
  public.list_league_discipline(uuid),
  public.is_player_suspended(uuid) from public, anon, authenticated;

grant execute on function public.record_disciplinary_incident(uuid, uuid, uuid, uuid, text, integer, integer, uuid, text),
  public.submit_suspension_appeal(uuid, text),
  public.resolve_suspension_appeal(uuid, text, integer, text) to authenticated;

grant execute on function public.list_league_discipline(uuid),
  public.is_player_suspended(uuid) to anon, authenticated;

commit;
