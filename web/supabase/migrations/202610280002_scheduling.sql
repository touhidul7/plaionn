begin;
create table public.venues(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),
 name text not null check(length(trim(name)) between 2 and 100),
 address text not null default '' check(length(address)<=300),
 time_zone text not null,unique(id,league_id)
);
create unique index venues_name_unique on public.venues(league_id,lower(name));
create table public.rinks(
 id uuid primary key default gen_random_uuid(),league_id uuid not null,
 venue_id uuid not null,name text not null check(length(trim(name)) between 1 and 100),
 foreign key(venue_id,league_id) references public.venues(id,league_id),unique(id,league_id)
);
create unique index rinks_name_unique on public.rinks(venue_id,lower(name));
create table public.games(
 id uuid primary key,league_id uuid not null references public.leagues(id),
 home_entry_id uuid not null,away_entry_id uuid not null,rink_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null check(status in ('draft','scheduled','cancelled')),
 revision integer not null default 1,
 foreign key(home_entry_id,league_id) references public.team_entries(id,league_id),
 foreign key(away_entry_id,league_id) references public.team_entries(id,league_id),
 foreign key(rink_id,league_id) references public.rinks(id,league_id),
 check(home_entry_id<>away_entry_id),
 check(isfinite(starts_at) and isfinite(ends_at) and ends_at-starts_at between interval '15 minutes' and interval '360 minutes')
);
create index games_time_index on public.games(league_id,starts_at,ends_at) where status<>'cancelled';
create table public.schedule_audit(
 id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),
 game_id uuid not null references public.games(id),actor_id uuid references auth.users(id),
 changed_at timestamptz not null default now(),reason text not null,
 previous_record jsonb,new_record jsonb not null
);
alter table public.venues enable row level security;
alter table public.rinks enable row level security;
alter table public.games enable row level security;
alter table public.schedule_audit enable row level security;
revoke all on public.venues,public.rinks,public.games,public.schedule_audit from anon,authenticated;
grant select on public.venues,public.rinks,public.games,public.schedule_audit to authenticated;
create policy venues_read on public.venues for select to authenticated using(public.is_league_member(league_id));
create policy rinks_read on public.rinks for select to authenticated using(public.is_league_member(league_id));
create policy games_read on public.games for select to authenticated using(public.is_league_member(league_id) and (status<>'draft' or public.is_league_commissioner(league_id)));
create policy schedule_audit_read on public.schedule_audit for select to authenticated using(public.is_league_commissioner(league_id));

create function public.create_venue(target_league uuid,venue_name text,venue_address text,zone text,first_rink text)
returns uuid language plpgsql security definer set search_path='' as $$
declare venue uuid;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception using errcode='22023',message='Invalid time zone'; end if;
 insert into public.venues(league_id,name,address,time_zone) values(target_league,trim(venue_name),trim(venue_address),zone) returning id into venue;
 insert into public.rinks(league_id,venue_id,name) values(target_league,venue,trim(first_rink));
 return venue;
end; $$;
create function public.create_rink(target_venue uuid,rink_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare tenant uuid; rink uuid;
begin
 select league_id into tenant from public.venues where id=target_venue;
 if auth.uid() is null or tenant is null or not public.is_league_commissioner(tenant) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 insert into public.rinks(league_id,venue_id,name) values(tenant,target_venue,trim(rink_name)) returning id into rink;
 return rink;
end; $$;

create function public.save_scheduled_game(target_game uuid,target_league uuid,home_entry uuid,away_entry uuid,
 target_rink uuid,start_time timestamptz,duration_minutes integer,game_status text,expected_revision integer,change_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare previous public.games; saved public.games; home_team uuid; away_team uuid; home_div uuid; away_div uuid; finish timestamptz;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 -- Serialize schedule mutations per league so simultaneous conflict checks cannot both pass.
 perform 1 from public.leagues where id=target_league for update;
 select * into previous from public.games where id=target_game;
 if previous.id is not null and previous.league_id<>target_league then raise exception using errcode='42501',message='Game is not in this league'; end if;
 if expected_revision is null or expected_revision<0 or
 (previous.id is null and expected_revision<>0) or (previous.id is not null and previous.revision<>expected_revision)
 then raise exception using errcode='P0001',message='GAME_STALE'; end if;
 if previous.id is not null and (change_reason is null or length(trim(change_reason))<3 or length(change_reason)>500) then
 raise exception using errcode='22023',message='CHANGE_REASON_REQUIRED'; end if;
 if start_time is null or not isfinite(start_time) or duration_minutes is null or duration_minutes not between 15 and 360
 then raise exception using errcode='22023',message='INVALID_GAME_TIME'; end if;
 finish=start_time+make_interval(mins=>duration_minutes);
 select team_id,division_id into home_team,home_div from public.team_entries where id=home_entry and league_id=target_league;
 select team_id,division_id into away_team,away_div from public.team_entries where id=away_entry and league_id=target_league;
 if home_team is null or away_team is null or home_team=away_team or home_div<>away_div then
 raise exception using errcode='22023',message='INVALID_MATCHUP'; end if;
 if not exists(select 1 from public.rinks where id=target_rink and league_id=target_league) then
 raise exception using errcode='42501',message='Rink is not in this league'; end if;
 if game_status<>'cancelled' then
  if exists(select 1 from public.games where league_id=target_league and id<>target_game and status<>'cancelled'
   and starts_at<finish and ends_at>start_time and rink_id=target_rink) then
   raise exception using errcode='P0001',message='RINK_CONFLICT'; end if;
  if exists(select 1 from public.games g join public.team_entries h on h.id=g.home_entry_id join public.team_entries a on a.id=g.away_entry_id
   where g.league_id=target_league and g.id<>target_game and g.status<>'cancelled' and g.starts_at<finish and g.ends_at>start_time
   and (h.team_id in(home_team,away_team) or a.team_id in(home_team,away_team))) then
   raise exception using errcode='P0001',message='TEAM_CONFLICT'; end if;
 end if;
 if previous.id is null then
  insert into public.games(id,league_id,home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status)
   values(target_game,target_league,home_entry,away_entry,target_rink,start_time,finish,game_status) returning * into saved;
 else
  update public.games set home_entry_id=home_entry,away_entry_id=away_entry,rink_id=target_rink,starts_at=start_time,
   ends_at=finish,status=game_status,revision=previous.revision+1 where id=target_game returning * into saved;
 end if;
 insert into public.schedule_audit(league_id,game_id,actor_id,reason,previous_record,new_record)
 values(target_league,target_game,auth.uid(),case when previous.id is null then 'Initial fixture' else trim(change_reason) end,
 case when previous.id is null then null else to_jsonb(previous) end,to_jsonb(saved));
 return saved.revision;
end; $$;
revoke all on function public.create_venue(uuid,text,text,text,text),public.create_rink(uuid,text),
 public.save_scheduled_game(uuid,uuid,uuid,uuid,uuid,timestamptz,integer,text,integer,text) from public,anon,authenticated;
grant execute on function public.create_venue(uuid,text,text,text,text),public.create_rink(uuid,text),
 public.save_scheduled_game(uuid,uuid,uuid,uuid,uuid,timestamptz,integer,text,integer,text) to authenticated;
commit;

