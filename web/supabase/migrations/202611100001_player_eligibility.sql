begin;

alter table public.roster_memberships
  add constraint roster_memberships_id_league_unique unique (id, league_id);

create table public.player_eligibility_overrides (
  id uuid primary key default gen_random_uuid(),
  roster_membership_id uuid not null,
  league_id uuid not null,
  season_id uuid not null,
  reason text not null check (length(trim(reason)) between 3 and 500),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  revocation_reason text,
  foreign key (roster_membership_id, league_id) references public.roster_memberships(id, league_id),
  foreign key (season_id, league_id) references public.seasons(id, league_id),
  check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null and length(trim(revocation_reason)) between 3 and 500)
  )
);
create unique index player_eligibility_one_active_override
  on public.player_eligibility_overrides(roster_membership_id) where revoked_at is null;

alter table public.player_eligibility_overrides enable row level security;
revoke all on public.player_eligibility_overrides from anon, authenticated;
grant select on public.player_eligibility_overrides to authenticated;
create policy eligibility_override_read on public.player_eligibility_overrides for select to authenticated
  using (public.is_league_commissioner(league_id));

create function public.check_player_eligibility(target_season uuid, target_entry uuid, target_player uuid)
returns table(eligible boolean, reason text)
language plpgsql stable security definer set search_path=''
as $$
declare target_league uuid; roster_status text; approved_registration uuid;
begin
  select e.league_id into target_league
  from public.team_entries e
  join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  where e.id=target_entry and d.season_id=target_season;
  if target_league is null then
    return query select false,'Team is not part of this season.'::text;
    return;
  end if;

  select r.status into roster_status
  from public.roster_memberships r
  where r.team_entry_id=target_entry and r.league_id=target_league and r.player_id=target_player;
  if roster_status is distinct from 'active' then
    return query select false,'Player is not active on this team.'::text;
    return;
  end if;

  select r.id into approved_registration
  from public.player_registrations r
  where r.season_id=target_season and r.league_id=target_league
    and r.player_id=target_player and r.status='approved'
  order by r.created_at desc,r.id
  limit 1;
  if approved_registration is null then
    return query select false,'No approved registration for this season.'::text;
    return;
  end if;

  if not exists (
    select 1 from public.season_documents d
    where d.season_id=target_season and d.document_type='waiver'
      and d.version=(select max(latest.version) from public.season_documents latest
        where latest.season_id=d.season_id and latest.document_type=d.document_type)
  ) then
    return query select false,'No current waiver is published.'::text;
    return;
  end if;

  if exists (
    select 1 from public.season_documents d
    where d.season_id=target_season
      and d.version=(select max(latest.version) from public.season_documents latest
        where latest.season_id=d.season_id and latest.document_type=d.document_type)
      and not exists (
        select 1 from public.registration_document_acceptances a
        where a.registration_id=approved_registration and a.document_id=d.id
          and a.document_version=d.version and a.document_sha256=d.sha256
      )
  ) then
    return query select false,'Current season documents have not all been accepted.'::text;
    return;
  end if;

  return query select true,'Approved registration and current required documents verified.'::text;
end;
$$;

revoke all on function public.check_player_eligibility(uuid,uuid,uuid) from public,anon,authenticated;

create function public.list_team_eligibility(target_entry uuid)
returns table(
  roster_membership_id uuid,
  player_id uuid,
  display_name text,
  status text,
  eligible boolean,
  reason text,
  override_id uuid,
  override_reason text
)
language plpgsql stable security definer set search_path=''
as $$
declare target_league uuid; target_season uuid;
begin
  select e.league_id,d.season_id into target_league,target_season
  from public.team_entries e
  join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  where e.id=target_entry;
  if auth.uid() is null or target_league is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501',message='Commissioner access required';
  end if;
  return query
  select r.id,r.player_id,p.display_name,r.status,
    checked.eligible or active_override.id is not null,
    case when active_override.id is not null then 'Commissioner eligibility override is active.'
      else checked.reason end,
    active_override.id,active_override.reason
  from public.roster_memberships r
  join public.players p on p.id=r.player_id
  cross join lateral public.check_player_eligibility(target_season,r.team_entry_id,r.player_id) checked
  left join public.player_eligibility_overrides active_override
    on active_override.roster_membership_id=r.id and active_override.league_id=target_league
      and active_override.season_id=target_season and active_override.revoked_at is null
  where r.team_entry_id=target_entry and r.league_id=target_league
  order by r.status,r.jersey_number nulls last,p.display_name;
end;
$$;

create function public.grant_player_eligibility_override(target_roster_membership uuid, change_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare member_id uuid; member_team_entry uuid; member_league uuid; member_player uuid; member_status text;
  target_league uuid; target_season uuid; base_eligible boolean; base_reason text; override_id uuid;
begin
  select r.id,r.team_entry_id,r.league_id,r.player_id,r.status
    into member_id,member_team_entry,member_league,member_player,member_status
  from public.roster_memberships r
  where r.id=target_roster_membership;
  select e.league_id,d.season_id into target_league,target_season
  from public.team_entries e join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  where e.id=member_team_entry and e.league_id=member_league;
  if auth.uid() is null or member_id is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501',message='Commissioner access required';
  end if;
  if member_status<>'active' then
    raise exception using errcode='P0001',message='PLAYER_NOT_ACTIVE_ON_TEAM';
  end if;
  if change_reason is null or length(trim(change_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='OVERRIDE_REASON_REQUIRED';
  end if;
  select c.eligible,c.reason into base_eligible,base_reason
  from public.check_player_eligibility(target_season,member_team_entry,member_player) c;
  if base_eligible then
    raise exception using errcode='P0001',message='PLAYER_ALREADY_ELIGIBLE';
  end if;
  insert into public.player_eligibility_overrides(
    roster_membership_id,league_id,season_id,reason,granted_by
  ) values (
    member_id,target_league,target_season,trim(change_reason),auth.uid()
  ) returning id into override_id;
  return override_id;
end;
$$;

create function public.revoke_player_eligibility_override(target_override uuid, change_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare override_record public.player_eligibility_overrides;
begin
  select * into override_record from public.player_eligibility_overrides where id=target_override for update;
  if auth.uid() is null or override_record.id is null or not public.is_league_commissioner(override_record.league_id) then
    raise exception using errcode='42501',message='Commissioner access required';
  end if;
  if override_record.revoked_at is not null then
    raise exception using errcode='P0001',message='OVERRIDE_ALREADY_REVOKED';
  end if;
  if change_reason is null or length(trim(change_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='REVOCATION_REASON_REQUIRED';
  end if;
  update public.player_eligibility_overrides
  set revoked_by=auth.uid(),revoked_at=now(),revocation_reason=trim(change_reason)
  where id=override_record.id;
end;
$$;

drop function public.list_game_score_roster(uuid);
create function public.list_game_score_roster(target_game uuid)
returns table(
  team_entry_id uuid,player_id uuid,display_name text,"position" text,jersey_number integer,
  eligible boolean,eligibility_reason text,override_reason text
)
language plpgsql security definer set search_path='' as $$
declare fixture public.games; target_season uuid;
begin
  select * into fixture from public.games where id=target_game;
  if auth.uid() is null or fixture.id is null or fixture.status<>'scheduled'
    or (not public.is_league_commissioner(fixture.league_id) and not exists(
      select 1 from public.game_officials o where o.game_id=fixture.id and o.user_id=auth.uid()
    )) then
    raise exception using errcode='42501',message='Assigned game official access required';
  end if;
  select d.season_id into target_season from public.team_entries e
  join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  where e.id=fixture.home_entry_id and e.league_id=fixture.league_id;
  return query
  select r.team_entry_id,r.player_id,p.display_name,r.position,r.jersey_number,
    checked.eligible or active_override.id is not null,
    case when active_override.id is not null then 'Commissioner eligibility override is active.'
      else checked.reason end,
    active_override.reason
  from public.roster_memberships r
  join public.players p on p.id=r.player_id
  cross join lateral public.check_player_eligibility(target_season,r.team_entry_id,r.player_id) checked
  left join public.player_eligibility_overrides active_override
    on active_override.roster_membership_id=r.id and active_override.league_id=fixture.league_id
      and active_override.season_id=target_season and active_override.revoked_at is null
  where r.league_id=fixture.league_id and r.status='active'
    and r.team_entry_id in(fixture.home_entry_id,fixture.away_entry_id)
  order by r.team_entry_id,r.position,p.display_name;
end;
$$;

create function public.enforce_game_event_eligibility()
returns trigger language plpgsql security definer set search_path=''
as $$
declare target_season uuid; event_player uuid; checked_eligible boolean; active_override uuid;
begin
  select d.season_id into target_season
  from public.team_entries e join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
  where e.id=new.team_entry_id and e.league_id=new.league_id;
  if target_season is null then
    raise exception using errcode='22023',message='PLAYER_NOT_ELIGIBLE';
  end if;
  foreach event_player in array array_remove(array[new.player_id,new.assist_one_id,new.assist_two_id],null) loop
    select c.eligible into checked_eligible
    from public.check_player_eligibility(target_season,new.team_entry_id,event_player) c;
    select o.id into active_override
    from public.roster_memberships r
    join public.player_eligibility_overrides o on o.roster_membership_id=r.id
      and o.league_id=new.league_id and o.season_id=target_season and o.revoked_at is null
    where r.team_entry_id=new.team_entry_id and r.league_id=new.league_id
      and r.player_id=event_player and r.status='active';
    if not coalesce(checked_eligible,false) and active_override is null then
      raise exception using errcode='P0001',message='PLAYER_NOT_ELIGIBLE';
    end if;
  end loop;
  return new;
end;
$$;
create trigger game_event_eligibility_guard before insert on public.game_events
  for each row execute function public.enforce_game_event_eligibility();

revoke all on function public.list_team_eligibility(uuid),
  public.grant_player_eligibility_override(uuid,text),
  public.revoke_player_eligibility_override(uuid,text),
  public.enforce_game_event_eligibility() from public,anon,authenticated;
grant execute on function public.list_team_eligibility(uuid),
  public.grant_player_eligibility_override(uuid,text),
  public.revoke_player_eligibility_override(uuid,text) to authenticated;
commit;
