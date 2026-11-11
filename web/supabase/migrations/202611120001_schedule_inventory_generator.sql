begin;
create table public.ice_slots(
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),
 division_id uuid not null,
 rink_id uuid not null,
 local_date date not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 time_tier text not null check(time_tier in ('early','prime','late')),
 is_required boolean not null default false,
 created_at timestamptz not null default now(),
 foreign key(rink_id,league_id) references public.rinks(id,league_id),
 foreign key(division_id,league_id) references public.divisions(id,league_id),
 unique(id,league_id),
 check(isfinite(starts_at) and isfinite(ends_at) and ends_at-starts_at between interval '15 minutes' and interval '360 minutes')
);
create index ice_slots_date_index on public.ice_slots(league_id,division_id,local_date,starts_at);
create table public.schedule_generation_rules(
 division_id uuid primary key,
 league_id uuid not null,
 start_date date not null,
 end_date date not null,
 round_robins integer not null check(round_robins between 1 and 4),
 max_games_per_week integer not null check(max_games_per_week between 1 and 7),
 min_rest_hours integer not null check(min_rest_hours between 0 and 168),
 preferred_weekdays smallint[] not null default '{}',
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 foreign key(division_id,league_id) references public.divisions(id,league_id),
 check(end_date>=start_date),
 check(cardinality(preferred_weekdays)<=7 and preferred_weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);
create table public.schedule_team_blackouts(
 league_id uuid not null,
 division_id uuid not null,
 team_entry_id uuid not null,
 blackout_date date not null,
 created_at timestamptz not null default now(),
 primary key(team_entry_id,blackout_date),
 foreign key(division_id,league_id) references public.divisions(id,league_id),
 foreign key(team_entry_id,league_id) references public.team_entries(id,league_id)
);
alter table public.games add column ice_slot_id uuid;
alter table public.games add column generated_schedule boolean not null default false;
alter table public.games add constraint games_ice_slot_league_fk
 foreign key(ice_slot_id,league_id) references public.ice_slots(id,league_id);
create unique index games_ice_slot_unique on public.games(ice_slot_id) where ice_slot_id is not null;
alter table public.ice_slots enable row level security;
alter table public.schedule_generation_rules enable row level security;
alter table public.schedule_team_blackouts enable row level security;
revoke all on public.ice_slots,public.schedule_generation_rules,public.schedule_team_blackouts from anon,authenticated;
grant select on public.ice_slots,public.schedule_generation_rules,public.schedule_team_blackouts to authenticated;
create policy ice_slots_read on public.ice_slots for select to authenticated using(public.is_league_member(league_id));
create policy schedule_rules_read on public.schedule_generation_rules for select to authenticated using(public.is_league_member(league_id));
create policy schedule_blackouts_read on public.schedule_team_blackouts for select to authenticated using(public.is_league_commissioner(league_id));

create function public.create_ice_slot(target_league uuid,target_division uuid,target_rink uuid,start_time timestamptz,end_time timestamptz,
 slot_tier text,slot_required boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare slot_id uuid; zone text; slot_date date;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=target_league for update;
 if not exists(select 1 from public.divisions where id=target_division and league_id=target_league) then
  raise exception using errcode='42501',message='Division is not in this league';
 end if;
 select v.time_zone into zone from public.rinks r join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
  where r.id=target_rink and r.league_id=target_league;
 if zone is null then raise exception using errcode='42501',message='Rink is not in this league'; end if;
 if start_time is null or end_time is null or not isfinite(start_time) or not isfinite(end_time)
  or end_time-start_time not between interval '15 minutes' and interval '360 minutes'
  or slot_tier is null or slot_tier not in ('early','prime','late') or slot_required is null then
  raise exception using errcode='22023',message='Invalid ice slot';
 end if;
 slot_date=(start_time at time zone zone)::date;
 if (end_time at time zone zone)::date<>slot_date then
  raise exception using errcode='22023',message='Ice slots must start and end on the same local date';
 end if;
 if exists(select 1 from public.ice_slots where league_id=target_league and rink_id=target_rink
  and starts_at<end_time and ends_at>start_time) then
  raise exception using errcode='P0001',message='ICE_SLOT_CONFLICT';
 end if;
 if exists(select 1 from public.games where league_id=target_league and rink_id=target_rink and status<>'cancelled'
  and starts_at<end_time and ends_at>start_time) then
  raise exception using errcode='P0001',message='GAME_CONFLICT';
 end if;
 insert into public.ice_slots(league_id,division_id,rink_id,local_date,starts_at,ends_at,time_tier,is_required)
 values(target_league,target_division,target_rink,slot_date,start_time,end_time,slot_tier,slot_required) returning id into slot_id;
 return slot_id;
end; $$;

create function public.remove_ice_slot(target_slot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 select league_id into tenant from public.ice_slots where id=target_slot;
 if auth.uid() is null or tenant is null or not public.is_league_commissioner(tenant) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=tenant for update;
 if exists(select 1 from public.games where ice_slot_id=target_slot and status<>'cancelled') then
  raise exception using errcode='P0001',message='ICE_SLOT_IN_USE';
 end if;
 delete from public.ice_slots where id=target_slot;
end; $$;

create function public.save_schedule_blackout(target_division uuid,target_entry uuid,blackout_day date,remove_entry boolean)
returns void language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 select league_id into tenant from public.divisions where id=target_division;
 if auth.uid() is null or tenant is null or not public.is_league_commissioner(tenant) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=tenant for update;
 if not exists(select 1 from public.team_entries where id=target_entry and division_id=target_division and league_id=tenant) then
  raise exception using errcode='42501',message='Team is not in this division';
 end if;
 if blackout_day is null then raise exception using errcode='22023',message='Invalid blackout date'; end if;
 if remove_entry then
  delete from public.schedule_team_blackouts where division_id=target_division and team_entry_id=target_entry and blackout_date=blackout_day;
 else
  insert into public.schedule_team_blackouts(league_id,division_id,team_entry_id,blackout_date)
  values(tenant,target_division,target_entry,blackout_day);
 end if;
end; $$;

create function public.generate_schedule_drafts(target_division uuid,start_date date,end_date date,
 round_robin_count integer,max_per_week integer,min_rest integer,preferred_weekdays smallint[],
 replace_existing_drafts boolean,fixture_data jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare tenant uuid; entry_count integer; expected_count integer; fixture_count integer; inserted_count integer; replaced_games jsonb;
begin
 select league_id into tenant from public.divisions where id=target_division;
 if auth.uid() is null or tenant is null or not public.is_league_commissioner(tenant) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=tenant for update;
 if start_date is null or end_date is null or end_date<start_date or round_robin_count is null or round_robin_count not between 1 and 4
  or max_per_week is null or max_per_week not between 1 and 7 or min_rest is null or min_rest not between 0 and 168
  or preferred_weekdays is null or cardinality(preferred_weekdays)>7
  or cardinality(preferred_weekdays)<>(select count(distinct day) from unnest(preferred_weekdays) day)
  or exists(select 1 from unnest(preferred_weekdays) day where day not between 1 and 7)
  or replace_existing_drafts is null
  or fixture_data is null or jsonb_typeof(fixture_data)<>'array' then
  raise exception using errcode='22023',message='INVALID_SCHEDULE_RULES';
 end if;
 select count(*) into entry_count from public.team_entries where league_id=tenant and division_id=target_division;
 if entry_count<2 then raise exception using errcode='P0001',message='NOT_ENOUGH_TEAMS'; end if;
 expected_count=(entry_count*(entry_count-1)/2)*round_robin_count;
 if expected_count>256 then raise exception using errcode='22023',message='SCHEDULE_TOO_LARGE'; end if;
 if exists(
  select 1 from public.games g join public.team_entries e on e.id=g.home_entry_id
   join public.rinks r on r.id=g.rink_id join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
  where g.league_id=tenant and e.division_id=target_division and g.status<>'cancelled'
   and not g.generated_schedule and (g.starts_at at time zone v.time_zone)::date between start_date and end_date
 ) then raise exception using errcode='P0001',message='SCHEDULE_ALREADY_EXISTS'; end if;
 if exists(
  select 1 from public.games g join public.team_entries e on e.id=g.home_entry_id
   join public.rinks r on r.id=g.rink_id join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
  where g.league_id=tenant and e.division_id=target_division and g.status<>'cancelled' and g.generated_schedule
   and (g.starts_at at time zone v.time_zone)::date between start_date and end_date
 ) then
  if not replace_existing_drafts then raise exception using errcode='P0001',message='REPLACEMENT_CONFIRMATION_REQUIRED'; end if;
  if exists(
   select 1 from public.games g join public.team_entries e on e.id=g.home_entry_id
    join public.rinks r on r.id=g.rink_id join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
   where g.league_id=tenant and e.division_id=target_division and g.status<>'cancelled' and g.generated_schedule
    and g.status<>'draft' and (g.starts_at at time zone v.time_zone)::date between start_date and end_date
  ) then raise exception using errcode='P0001',message='PUBLISHED_SCHEDULE_EXISTS'; end if;
  select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into replaced_games
   from public.games g join public.team_entries e on e.id=g.home_entry_id
    join public.rinks r on r.id=g.rink_id join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
   where g.league_id=tenant and e.division_id=target_division and g.status='draft' and g.generated_schedule
    and (g.starts_at at time zone v.time_zone)::date between start_date and end_date;
  update public.games g set status='cancelled',revision=g.revision+1,ice_slot_id=null
   from public.team_entries e,public.rinks r,public.venues v
   where e.id=g.home_entry_id and e.division_id=target_division and r.id=g.rink_id and r.league_id=g.league_id
    and v.id=r.venue_id and v.league_id=r.league_id and g.league_id=tenant and g.status='draft' and g.generated_schedule
    and (g.starts_at at time zone v.time_zone)::date between start_date and end_date;
  insert into public.schedule_audit(league_id,game_id,actor_id,reason,previous_record,new_record)
   select tenant,(old_record->>'id')::uuid,auth.uid(),'Replaced generated schedule',old_record,to_jsonb(g)
   from jsonb_array_elements(replaced_games) as previous(old_record)
   join public.games g on g.id=(previous.old_record->>'id')::uuid;
 end if;
 if replace_existing_drafts and exists(
  select 1 from public.games g join public.team_entries e on e.id=g.home_entry_id
   join public.rinks r on r.id=g.rink_id join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
  where g.league_id=tenant and e.division_id=target_division and g.status<>'cancelled' and not g.generated_schedule
   and (g.starts_at at time zone v.time_zone)::date between start_date and end_date
 ) then raise exception using errcode='P0001',message='SCHEDULE_ALREADY_EXISTS'; end if;
 fixture_count=jsonb_array_length(fixture_data);
 if fixture_count<>expected_count then raise exception using errcode='22023',message='INVALID_FIXTURE_COUNT'; end if;
 if exists(
  select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
  left join public.ice_slots s on s.id=f.slot_id and s.league_id=tenant and s.division_id=target_division
  left join public.team_entries h on h.id=f.home_entry_id and h.league_id=tenant and h.division_id=target_division
  left join public.team_entries a on a.id=f.away_entry_id and a.league_id=tenant and a.division_id=target_division
  where f.game_id is null or f.slot_id is null or f.home_entry_id is null or f.away_entry_id is null
   or f.home_entry_id=f.away_entry_id or s.id is null or h.id is null or a.id is null
   or s.local_date not between start_date and end_date
 ) then raise exception using errcode='22023',message='INVALID_FIXTURE'; end if;
 if (select count(distinct f.slot_id) from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid))<>fixture_count
  or (select count(distinct f.game_id) from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid))<>fixture_count then
  raise exception using errcode='22023',message='DUPLICATE_FIXTURE_SLOT';
 end if;
 if exists(select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
  join public.games g on g.ice_slot_id=f.slot_id and g.status<>'cancelled') then
  raise exception using errcode='P0001',message='ICE_SLOT_ALREADY_USED';
 end if;
 if exists(
  select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
  join public.ice_slots s on s.id=f.slot_id and s.league_id=tenant and s.division_id=target_division
  join public.schedule_team_blackouts b on b.division_id=target_division and b.blackout_date=s.local_date
   and b.team_entry_id in(f.home_entry_id,f.away_entry_id)
 ) then raise exception using errcode='P0001',message='TEAM_BLACKOUT'; end if;
 if exists(
  select 1 from public.ice_slots s where s.league_id=tenant and s.division_id=target_division and s.local_date between start_date and end_date and s.is_required
   and not exists(select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid) where f.slot_id=s.id)
 ) then raise exception using errcode='P0001',message='REQUIRED_SLOT_UNUSED'; end if;
 if exists(
  select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
  join public.ice_slots s on s.id=f.slot_id and s.league_id=tenant and s.division_id=target_division
  where exists(select 1 from public.games g where g.league_id=tenant and g.status<>'cancelled' and g.rink_id=s.rink_id
   and g.starts_at<s.ends_at and g.ends_at>s.starts_at)
   or exists(select 1 from public.games g join public.team_entries h on h.id=g.home_entry_id join public.team_entries a on a.id=g.away_entry_id
    where g.league_id=tenant and g.status<>'cancelled' and (h.team_id in(
      select team_id from public.team_entries where id in(f.home_entry_id,f.away_entry_id)
     ) or a.team_id in(select team_id from public.team_entries where id in(f.home_entry_id,f.away_entry_id)))
     and g.starts_at<s.ends_at and g.ends_at>s.starts_at)
 ) then raise exception using errcode='P0001',message='EXISTING_GAME_CONFLICT'; end if;
 if exists(
  with planned as (
   select e.team_id,s.local_date::timestamp local_game_date
   from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
    join public.ice_slots s on s.id=f.slot_id and s.league_id=tenant and s.division_id=target_division
    cross join lateral (values(f.home_entry_id),(f.away_entry_id)) participant(entry_id)
    join public.team_entries e on e.id=participant.entry_id
  ), existing as (
   select e.team_id,(g.starts_at at time zone v.time_zone) local_game_date
   from public.games g join public.rinks r on r.id=g.rink_id
    join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
    cross join lateral (values(g.home_entry_id),(g.away_entry_id)) participant(entry_id)
    join public.team_entries e on e.id=participant.entry_id
   where g.league_id=tenant and g.status<>'cancelled'
  ), combined as (select * from planned union all select * from existing)
  select 1 from combined group by team_id,date_trunc('week',local_game_date) having count(*)>max_per_week
 ) then raise exception using errcode='P0001',message='MAX_GAMES_PER_WEEK'; end if;
 if exists(
  with planned as (
   select e.team_id,s.starts_at,s.ends_at from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
    join public.ice_slots s on s.id=f.slot_id and s.league_id=tenant and s.division_id=target_division
    cross join lateral (values(f.home_entry_id),(f.away_entry_id)) participant(entry_id)
    join public.team_entries e on e.id=participant.entry_id
  ), all_bookings as (
   select e.team_id,g.starts_at,g.ends_at from public.games g
    join public.team_entries e on e.id in(g.home_entry_id,g.away_entry_id)
   where g.league_id=tenant and g.status<>'cancelled'
   union all select team_id,starts_at,ends_at from planned
  ), ordered as (
   select team_id,starts_at,lag(ends_at) over(partition by team_id order by starts_at,ends_at) previous_end
   from all_bookings
  )
  select 1 from ordered where previous_end is not null and starts_at-previous_end<make_interval(hours=>min_rest)
 ) then raise exception using errcode='P0001',message='MINIMUM_REST'; end if;
 if exists(
  select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
  group by least(home_entry_id,away_entry_id),greatest(home_entry_id,away_entry_id)
  having count(*)<>round_robin_count
 ) then raise exception using errcode='22023',message='INVALID_OPPONENT_MATRIX'; end if;
 if exists(select 1 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
  join public.games g on g.id=f.game_id) then raise exception using errcode='23505',message='GAME_ID_EXISTS'; end if;
 insert into public.games(id,league_id,home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status,ice_slot_id,generated_schedule)
 select f.game_id,tenant,f.home_entry_id,f.away_entry_id,s.rink_id,s.starts_at,s.ends_at,'draft',s.id,true
 from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
 join public.ice_slots s on s.id=f.slot_id and s.league_id=tenant and s.division_id=target_division;
 get diagnostics inserted_count=row_count;
 insert into public.schedule_audit(league_id,game_id,actor_id,reason,previous_record,new_record)
 select tenant,g.id,auth.uid(),'Generated schedule draft',null,to_jsonb(g)
 from public.games g where g.league_id=tenant and g.ice_slot_id in(
  select slot_id from jsonb_to_recordset(fixture_data) as f(game_id uuid,slot_id uuid,home_entry_id uuid,away_entry_id uuid)
 );
 insert into public.schedule_generation_rules(division_id,league_id,start_date,end_date,round_robins,max_games_per_week,min_rest_hours,preferred_weekdays,updated_at,updated_by)
 values(target_division,tenant,start_date,end_date,round_robin_count,max_per_week,min_rest,preferred_weekdays,now(),auth.uid())
 on conflict(division_id) do update set start_date=excluded.start_date,end_date=excluded.end_date,
  round_robins=excluded.round_robins,max_games_per_week=excluded.max_games_per_week,min_rest_hours=excluded.min_rest_hours,
  preferred_weekdays=excluded.preferred_weekdays,
  updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 return inserted_count;
end; $$;

create function public.publish_schedule_drafts(target_division uuid,start_date date,end_date date)
returns integer language plpgsql security definer set search_path='' as $$
declare tenant uuid; published integer;
begin
 select league_id into tenant from public.divisions where id=target_division;
 if auth.uid() is null or tenant is null or not public.is_league_commissioner(tenant) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 perform 1 from public.leagues where id=tenant for update;
 if start_date is null or end_date is null or end_date<start_date then raise exception using errcode='22023',message='INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.games g join public.team_entries e on e.id=g.home_entry_id
  join public.rinks r on r.id=g.rink_id join public.venues v on v.id=r.venue_id and v.league_id=r.league_id
  where g.league_id=tenant and g.generated_schedule and g.status='draft' and e.division_id=target_division
   and (g.starts_at at time zone v.time_zone)::date between start_date and end_date) then
  raise exception using errcode='P0001',message='NO_GENERATED_DRAFTS';
 end if;
 if exists(select 1 from public.ice_slots s where s.league_id=tenant and s.division_id=target_division
  and s.local_date between start_date and end_date and s.is_required
  and not exists(select 1 from public.games g where g.ice_slot_id=s.id and g.status<>'cancelled')) then
  raise exception using errcode='P0001',message='REQUIRED_SLOT_UNUSED';
 end if;
 with changed as (
  update public.games g set status='scheduled',revision=g.revision+1
  from public.team_entries e,public.rinks r,public.venues v
  where e.id=g.home_entry_id and e.division_id=target_division and r.id=g.rink_id and r.league_id=g.league_id
   and v.id=r.venue_id and v.league_id=r.league_id and g.league_id=tenant and g.generated_schedule and g.status='draft'
   and (g.starts_at at time zone v.time_zone)::date between start_date and end_date
  returning g.*
 )
 insert into public.schedule_audit(league_id,game_id,actor_id,reason,previous_record,new_record)
 select tenant,changed.id,auth.uid(),'Published generated schedule',
  jsonb_set(jsonb_set(to_jsonb(changed),'{status}',to_jsonb('draft'::text)),'{revision}',to_jsonb(changed.revision-1)),
  to_jsonb(changed)
 from changed
 ;
 get diagnostics published=row_count;
 return published;
end; $$;

revoke all on function public.create_ice_slot(uuid,uuid,uuid,timestamptz,timestamptz,text,boolean),
 public.remove_ice_slot(uuid),public.save_schedule_blackout(uuid,uuid,date,boolean),
 public.generate_schedule_drafts(uuid,date,date,integer,integer,integer,smallint[],boolean,jsonb),
 public.publish_schedule_drafts(uuid,date,date) from public,anon,authenticated;
grant execute on function public.create_ice_slot(uuid,uuid,uuid,timestamptz,timestamptz,text,boolean),
 public.remove_ice_slot(uuid),public.save_schedule_blackout(uuid,uuid,date,boolean),
 public.generate_schedule_drafts(uuid,date,date,integer,integer,integer,smallint[],boolean,jsonb),
 public.publish_schedule_drafts(uuid,date,date) to authenticated;

create function public.release_stale_ice_slot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.ice_slot_id is not null and (new.status='cancelled' or new.rink_id<>old.rink_id
  or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at) then
  new.ice_slot_id=null;
 end if;
 return new;
end; $$;
revoke all on function public.release_stale_ice_slot() from public,anon,authenticated;
create trigger release_stale_ice_slot_before_update before update on public.games
 for each row execute function public.release_stale_ice_slot();

create function public.attach_matching_ice_slot() returns trigger
language plpgsql security invoker set search_path='' as $$
declare matching_slot uuid;
begin
 if new.ice_slot_id is null and new.status<>'cancelled' then
  select s.id into matching_slot from public.ice_slots s
   join public.team_entries h on h.id=new.home_entry_id and h.division_id=s.division_id and h.league_id=s.league_id
   join public.team_entries a on a.id=new.away_entry_id and a.division_id=s.division_id and a.league_id=s.league_id
  where s.league_id=new.league_id and s.rink_id=new.rink_id and s.starts_at=new.starts_at and s.ends_at=new.ends_at
   and not exists(select 1 from public.games g where g.ice_slot_id=s.id and g.status<>'cancelled' and g.id<>new.id)
  order by s.id limit 1;
  new.ice_slot_id=matching_slot;
 end if;
 return new;
end; $$;
revoke all on function public.attach_matching_ice_slot() from public,anon,authenticated;
create trigger zz_attach_matching_ice_slot_before_write before insert or update on public.games
 for each row execute function public.attach_matching_ice_slot();
commit;
