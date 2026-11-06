begin;

alter table public.games add constraint games_id_league_unique unique(id,league_id);

create table public.game_events (
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null,
 league_id uuid not null,
 client_event_id uuid not null,
 event_kind text not null check(event_kind in ('goal','penalty')),
 team_entry_id uuid not null,
 period integer not null check(period between 1 and 10),
 clock_seconds_remaining integer not null check(clock_seconds_remaining between 0 and 3600),
 player_id uuid not null references public.players(id),
 assist_one_id uuid references public.players(id),
 assist_two_id uuid references public.players(id),
 penalty_minutes integer,
 recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default now(),
 foreign key(game_id,league_id) references public.games(id,league_id),
 foreign key(team_entry_id,league_id) references public.team_entries(id,league_id),
 unique(game_id,client_event_id),
 check(
  (event_kind='goal' and penalty_minutes is null and player_id is not null
   and (assist_one_id is null or assist_one_id<>player_id)
   and (assist_two_id is null or (assist_two_id<>player_id and assist_two_id is distinct from assist_one_id)))
  or
  (event_kind='penalty' and penalty_minutes is not null and penalty_minutes in (2,4,5,10)
   and assist_one_id is null and assist_two_id is null)
 )
);
create index game_events_feed on public.game_events(game_id,recorded_at,id);

create table public.game_event_voids (
 event_id uuid primary key references public.game_events(id),
 game_id uuid not null references public.games(id),
 league_id uuid not null references public.leagues(id),
 voided_by uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 3 and 500),
 voided_at timestamptz not null default now()
);

alter table public.game_events enable row level security;
alter table public.game_event_voids enable row level security;
revoke all on public.game_events,public.game_event_voids from anon,authenticated;
grant select on public.game_events,public.game_event_voids to authenticated;

create policy game_events_read on public.game_events for select to authenticated using(
 public.is_league_commissioner(league_id)
 or exists(select 1 from public.game_officials o where o.game_id=game_events.game_id and o.user_id=auth.uid())
);
create policy game_event_voids_read on public.game_event_voids for select to authenticated using(
 public.is_league_commissioner(league_id)
 or exists(select 1 from public.game_officials o where o.game_id=game_event_voids.game_id and o.user_id=auth.uid())
);

create function public.list_game_score_roster(target_game uuid)
returns table(team_entry_id uuid,player_id uuid,display_name text,"position" text,jersey_number integer)
language plpgsql security definer set search_path='' as $$
declare fixture public.games;
begin
 select * into fixture from public.games where id=target_game;
 if auth.uid() is null or fixture.id is null or fixture.status<>'scheduled'
  or (not public.is_league_commissioner(fixture.league_id) and not exists(
   select 1 from public.game_officials o where o.game_id=fixture.id and o.user_id=auth.uid()
  )) then
  raise exception using errcode='42501',message='Assigned game official access required';
 end if;
 return query
 select r.team_entry_id,r.player_id,p.display_name,r.position,r.jersey_number
 from public.roster_memberships r
 join public.players p on p.id=r.player_id
 where r.league_id=fixture.league_id and r.status='active'
  and r.team_entry_id in(fixture.home_entry_id,fixture.away_entry_id)
 order by r.team_entry_id,r.position,p.display_name;
end; $$;

create function public.add_game_event(
 target_game uuid,client_event uuid,event_type text,target_entry uuid,target_period integer,
 clock_remaining integer,target_player uuid,assist_one uuid,assist_two uuid,penalty_duration integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare fixture public.games; settings public.season_settings; existing public.game_events; saved uuid; target_season uuid;
begin
 select * into fixture from public.games where id=target_game for update;
 if auth.uid() is null or fixture.id is null or fixture.status<>'scheduled'
  or (not public.is_league_commissioner(fixture.league_id) and not exists(
   select 1 from public.game_officials o where o.game_id=fixture.id and o.user_id=auth.uid() and o.role='timekeeper'
  )) then
  raise exception using errcode='42501',message='Assigned timekeeper access required';
 end if;

 select d.season_id into target_season from public.team_entries e
 join public.divisions d on d.id=e.division_id and d.league_id=e.league_id
 where e.id=fixture.home_entry_id and e.league_id=fixture.league_id;
 select * into settings from public.season_settings s where s.season_id=target_season and s.league_id=fixture.league_id;
 if settings.season_id is null then raise exception using errcode='P0001',message='SEASON_SETTINGS_REQUIRED'; end if;
 if client_event is null or event_type is null or event_type not in ('goal','penalty')
  or target_period is null or target_period not between 1 and settings.period_count
  or clock_remaining is null or clock_remaining not between 0 and settings.period_minutes*60 then
  raise exception using errcode='22023',message='INVALID_GAME_EVENT';
 end if;
 if target_entry is null or target_entry not in(fixture.home_entry_id,fixture.away_entry_id) then
  raise exception using errcode='22023',message='INVALID_GAME_TEAM';
 end if;
 if not exists(select 1 from public.roster_memberships r
  where r.league_id=fixture.league_id and r.team_entry_id=target_entry and r.player_id=target_player and r.status='active')
 then raise exception using errcode='22023',message='PLAYER_NOT_ACTIVE_ON_TEAM'; end if;

 if event_type='goal' then
  if penalty_duration is not null then raise exception using errcode='22023',message='INVALID_GAME_EVENT'; end if;
  if assist_one is not null and (assist_one=target_player or not exists(select 1 from public.roster_memberships r
   where r.league_id=fixture.league_id and r.team_entry_id=target_entry and r.player_id=assist_one and r.status='active'))
  then raise exception using errcode='22023',message='INVALID_ASSIST'; end if;
  if assist_two is not null and (assist_two=target_player or assist_two is not distinct from assist_one or not exists(select 1 from public.roster_memberships r
   where r.league_id=fixture.league_id and r.team_entry_id=target_entry and r.player_id=assist_two and r.status='active'))
  then raise exception using errcode='22023',message='INVALID_ASSIST'; end if;
 elsif penalty_duration is null or penalty_duration not in(2,4,5,10) or assist_one is not null or assist_two is not null then
  raise exception using errcode='22023',message='INVALID_PENALTY';
 end if;

 select * into existing from public.game_events e where e.game_id=fixture.id and e.client_event_id=client_event;
 if existing.id is not null then
  if existing.event_kind is distinct from event_type or existing.team_entry_id is distinct from target_entry
   or existing.period is distinct from target_period or existing.clock_seconds_remaining is distinct from clock_remaining
   or existing.player_id is distinct from target_player or existing.assist_one_id is distinct from assist_one
   or existing.assist_two_id is distinct from assist_two or existing.penalty_minutes is distinct from penalty_duration then
   raise exception using errcode='P0001',message='EVENT_IDEMPOTENCY_CONFLICT';
  end if;
  return existing.id;
 end if;

 insert into public.game_events(game_id,league_id,client_event_id,event_kind,team_entry_id,period,
  clock_seconds_remaining,player_id,assist_one_id,assist_two_id,penalty_minutes,recorded_by)
 values(fixture.id,fixture.league_id,client_event,event_type,target_entry,target_period,
  clock_remaining,target_player,assist_one,assist_two,penalty_duration,auth.uid())
 returning id into saved;
 return saved;
end; $$;

create function public.void_game_event(target_event uuid,change_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare event_record public.game_events; fixture public.games;
begin
 select * into event_record from public.game_events where id=target_event;
 if auth.uid() is null or event_record.id is null then
  raise exception using errcode='42501',message='Game event unavailable';
 end if;
 select * into fixture from public.games where id=event_record.game_id for update;
 if not public.is_league_commissioner(event_record.league_id) and not exists(
  select 1 from public.game_officials o where o.game_id=event_record.game_id and o.user_id=auth.uid() and o.role='referee'
 ) then raise exception using errcode='42501',message='Referee or commissioner access required'; end if;
 if fixture.status<>'scheduled' then raise exception using errcode='P0001',message='GAME_NOT_EDITABLE'; end if;
 if change_reason is null or length(trim(change_reason)) not between 3 and 500 then
  raise exception using errcode='22023',message='VOID_REASON_REQUIRED';
 end if;
 insert into public.game_event_voids(event_id,game_id,league_id,voided_by,reason)
 values(event_record.id,event_record.game_id,event_record.league_id,auth.uid(),trim(change_reason));
end; $$;

revoke all on function public.list_game_score_roster(uuid),
 public.add_game_event(uuid,uuid,text,uuid,integer,integer,uuid,uuid,uuid,integer),
 public.void_game_event(uuid,text) from public,anon,authenticated;
grant execute on function public.list_game_score_roster(uuid),
 public.add_game_event(uuid,uuid,text,uuid,integer,integer,uuid,uuid,uuid,integer),
 public.void_game_event(uuid,text) to authenticated;

commit;
