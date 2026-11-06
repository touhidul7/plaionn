begin;
alter table public.team_entries add constraint team_entries_id_league_unique unique(id,league_id);
-- Stable player identity; unclaimed profiles are never merged by name.
create table public.players (
 id uuid primary key default gen_random_uuid(),
 display_name text not null check(length(trim(display_name)) between 2 and 100),
 created_at timestamptz not null default now()
);
create table public.league_players (
 league_id uuid not null references public.leagues(id),
 player_id uuid not null references public.players(id),
 primary key(league_id,player_id)
);
create table public.roster_memberships (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null,
 team_entry_id uuid not null,
 player_id uuid not null,
 jersey_number integer check(jersey_number between 0 and 99),
 position text not null check(position in ('C','LW','RW','D','G','F')),
 status text not null check(status in ('active','inactive')),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 foreign key(team_entry_id,league_id) references public.team_entries(id,league_id),
 foreign key(league_id,player_id) references public.league_players(league_id,player_id),
 unique(team_entry_id,player_id)
);
create unique index roster_active_jersey on public.roster_memberships(team_entry_id,jersey_number)
 where status='active' and jersey_number is not null;
create table public.roster_audit (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),
 team_entry_id uuid not null references public.team_entries(id),
 actor_id uuid references auth.users(id),
 changed_at timestamptz not null default now(),
 previous_record jsonb,
 new_record jsonb not null
);
alter table public.players enable row level security;
alter table public.league_players enable row level security;
alter table public.roster_memberships enable row level security;
alter table public.roster_audit enable row level security;
revoke all on public.players,public.league_players,public.roster_memberships,public.roster_audit from anon,authenticated;
grant select on public.players,public.league_players,public.roster_memberships,public.roster_audit to authenticated;
-- Private roster access is commissioner-only until explicit captain assignments/player consent ship.
create policy league_players_read on public.league_players for select to authenticated using(public.is_league_commissioner(league_id));
create policy players_read on public.players for select to authenticated using(exists(
 select 1 from public.league_players lp where lp.player_id=players.id and public.is_league_commissioner(lp.league_id)
));
create policy roster_read on public.roster_memberships for select to authenticated using(public.is_league_commissioner(league_id));
create policy roster_audit_read on public.roster_audit for select to authenticated using(public.is_league_commissioner(league_id));

create function public.create_league_player(target_league uuid,player_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare player uuid;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 insert into public.players(display_name) values(trim(player_name)) returning id into player;
 insert into public.league_players(league_id,player_id) values(target_league,player);
 return player;
end; $$;

create function public.save_roster_member(target_entry uuid,target_player uuid,jersey integer,
 player_position text,member_status text,expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare target_league uuid; target_season uuid; max_players integer; current_count integer;
 previous public.roster_memberships; saved public.roster_memberships;
begin
 select e.league_id,d.season_id into target_league,target_season
 from public.team_entries e join public.divisions d on d.id=e.division_id and d.league_id=e.league_id where e.id=target_entry;
 if auth.uid() is null or target_league is null or not public.is_league_commissioner(target_league) then
  raise exception using errcode='42501',message='Commissioner access required';
 end if;
 if not exists(select 1 from public.league_players where league_id=target_league and player_id=target_player) then
  raise exception using errcode='42501',message='Player is not in this league';
 end if;
 if expected_revision is null or expected_revision<0 then
  raise exception using errcode='22023',message='Invalid revision';
 end if;
 -- Always acquire settings before team locks; settings changes cannot race roster additions.
 select roster_limit into max_players from public.season_settings where season_id=target_season for share;
 perform 1 from public.team_entries where id=target_entry for update;
 select * into previous from public.roster_memberships where team_entry_id=target_entry and player_id=target_player;
 if (previous.id is null and expected_revision<>0) or (previous.id is not null and previous.revision<>expected_revision) then
  raise exception using errcode='P0001',message='ROSTER_STALE';
 end if;
 if member_status='active' then
  if max_players is null then raise exception using errcode='P0001',message='ROSTER_NOT_CONFIGURED'; end if;
  select count(*) into current_count from public.roster_memberships
   where team_entry_id=target_entry and status='active' and player_id<>target_player;
  if current_count>=max_players then raise exception using errcode='P0001',message='ROSTER_FULL'; end if;
 end if;
 if previous.id is null then
  insert into public.roster_memberships(league_id,team_entry_id,player_id,jersey_number,position,status)
   values(target_league,target_entry,target_player,jersey,player_position,member_status) returning * into saved;
 else
  update public.roster_memberships set jersey_number=jersey,position=player_position,status=member_status,
   revision=previous.revision+1,updated_at=now() where id=previous.id returning * into saved;
 end if;
 insert into public.roster_audit(league_id,team_entry_id,actor_id,previous_record,new_record)
 values(target_league,target_entry,auth.uid(),case when previous.id is null then null else to_jsonb(previous) end,to_jsonb(saved));
 return saved.revision;
end; $$;

create function public.guard_roster_limit_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.roster_limit<old.roster_limit and exists(
  select 1 from public.roster_memberships r
  join public.team_entries e on e.id=r.team_entry_id
  join public.divisions d on d.id=e.division_id
  where d.season_id=new.season_id and r.status='active'
  group by r.team_entry_id having count(*)>new.roster_limit
 ) then raise exception using errcode='P0001',message='ROSTER_LIMIT_BELOW_CURRENT'; end if;
 return new;
end; $$;
create trigger roster_limit_change before update on public.season_settings
 for each row execute function public.guard_roster_limit_change();
revoke all on function public.create_league_player(uuid,text),public.save_roster_member(uuid,uuid,integer,text,text,integer),
 public.guard_roster_limit_change() from public,anon,authenticated;
grant execute on function public.create_league_player(uuid,text),
 public.save_roster_member(uuid,uuid,integer,text,text,integer) to authenticated;
commit;

