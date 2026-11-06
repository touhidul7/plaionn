begin;
alter table public.season_settings add column registration_enabled boolean not null default false;
grant update(registration_enabled) on public.season_settings to authenticated;
alter table public.players add column owner_user_id uuid unique references auth.users(id);
create policy player_self_read on public.players for select to authenticated using(owner_user_id=auth.uid());
create table public.player_registrations (
 id uuid primary key default gen_random_uuid(),league_id uuid not null,
 season_name text not null,league_name text not null,season_id uuid not null,user_id uuid not null references auth.users(id),player_id uuid not null references public.players(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 position text not null check(position in ('C','LW','RW','D','G','F')),
 revision integer not null default 1,created_at timestamptz not null default now(),
 unique(season_id,user_id),foreign key(season_id,league_id) references public.seasons(id,league_id)
);
create table public.registration_audit (
 id uuid primary key default gen_random_uuid(),registration_id uuid not null references public.player_registrations(id),
 league_id uuid not null references public.leagues(id),actor_id uuid not null references auth.users(id),
 changed_at timestamptz not null default now(),previous_status text,new_status text not null,reason text not null
);
alter table public.player_registrations enable row level security;
alter table public.registration_audit enable row level security;
revoke all on public.player_registrations,public.registration_audit from anon,authenticated;
grant select on public.player_registrations,public.registration_audit to authenticated;
create policy registration_read on public.player_registrations for select to authenticated using(user_id=auth.uid() or public.is_league_commissioner(league_id));
create policy registration_audit_read on public.registration_audit for select to authenticated using(public.is_league_commissioner(league_id) or exists(select 1 from public.player_registrations r where r.id=registration_id and r.user_id=auth.uid()));
create policy applicant_profile_read on public.players for select to authenticated using(exists(select 1 from public.player_registrations r where r.player_id=players.id and public.is_league_commissioner(r.league_id)));

-- Deliberate registration publication exposes only season/league labels and dates
-- to signed-in users, including people who have no league membership yet.
create function public.open_registration_seasons() returns table(season_id uuid,league_name text,season_name text,opens date,closes date)
language sql stable security definer set search_path='' as $$
 select s.season_id,l.name,se.name,s.registration_opens,s.registration_closes
 from public.season_settings s join public.leagues l on l.id=s.league_id join public.seasons se on se.id=s.season_id
 where auth.uid() is not null and s.registration_enabled and s.registration_opens is not null and s.registration_closes is not null
 and (now() at time zone 'UTC')::date between s.registration_opens and s.registration_closes;
$$;
create function public.set_registration_open(target_season uuid,enabled boolean,expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare settings public.season_settings;
begin
 select * into settings from public.season_settings where season_id=target_season for update;
 if auth.uid() is null or settings.season_id is null or not public.is_league_commissioner(settings.league_id) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 if expected_revision is null or expected_revision<>settings.revision then raise exception 'REGISTRATION_STALE'; end if;
 if enabled and (settings.registration_opens is null or settings.registration_closes is null) then raise exception 'REGISTRATION_DATES_REQUIRED'; end if;
 update public.season_settings set registration_enabled=enabled where season_id=target_season;
end; $$;
create function public.submit_registration(target_season uuid,player_name text,preferred_position text)
returns uuid language plpgsql security definer set search_path='' as $$
declare settings public.season_settings; player uuid; request_id uuid;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Sign in required'; end if;
 -- Serialize submissions by account to preserve one global owned profile.
 perform 1 from auth.users where id=auth.uid() for update;
 select * into settings from public.season_settings where season_id=target_season for share;
 if settings.season_id is null or not settings.registration_enabled or settings.registration_opens is null or settings.registration_closes is null
 or (now() at time zone 'UTC')::date not between settings.registration_opens and settings.registration_closes then raise exception 'REGISTRATION_CLOSED'; end if;
 if exists(select 1 from public.player_registrations where season_id=target_season and user_id=auth.uid()) then raise exception 'REGISTRATION_EXISTS'; end if;
 select id into player from public.players where owner_user_id=auth.uid();
 if player is null then
  insert into public.players(display_name,owner_user_id) values(trim(player_name),auth.uid()) returning id into player;
 end if;
 insert into public.player_registrations(league_id,season_id,user_id,player_id,position,season_name,league_name)
 values(settings.league_id,target_season,auth.uid(),player,preferred_position,(select name from public.seasons where id=target_season),(select name from public.leagues where id=settings.league_id)) returning id into request_id;
 insert into public.registration_audit(registration_id,league_id,actor_id,new_status,reason)
 values(request_id,settings.league_id,auth.uid(),'pending','Player submitted application');
 return request_id;
end; $$;
create function public.decide_registration(target_registration uuid,decision text,expected_revision integer,change_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare request public.player_registrations;
begin
 select * into request from public.player_registrations where id=target_registration for update;
 if auth.uid() is null or request.id is null then raise exception using errcode='42501',message='Application unavailable'; end if;
 if decision='withdrawn' then
  if request.user_id<>auth.uid() then raise exception using errcode='42501',message='Applicant access required'; end if;
 elsif decision in ('approved','rejected') then
  if not public.is_league_commissioner(request.league_id) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 else raise exception using errcode='22023',message='Invalid decision'; end if;
 if request.status<>'pending' or expected_revision is null or expected_revision<>request.revision then raise exception 'REGISTRATION_STALE'; end if;
 if change_reason is null or length(trim(change_reason)) not between 3 and 500 then raise exception using errcode='22023',message='Reason required'; end if;
 if decision='approved' then
  insert into public.league_memberships(league_id,user_id,role) values(request.league_id,request.user_id,'player') on conflict do nothing;
  insert into public.league_players(league_id,player_id) values(request.league_id,request.player_id) on conflict do nothing;
 end if;
 update public.player_registrations set status=decision,revision=revision+1 where id=request.id;
 insert into public.registration_audit(registration_id,league_id,actor_id,previous_status,new_status,reason)
 values(request.id,request.league_id,auth.uid(),request.status,decision,trim(change_reason));
end; $$;
revoke all on function public.open_registration_seasons(),public.set_registration_open(uuid,boolean,integer),public.submit_registration(uuid,text,text),public.decide_registration(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.open_registration_seasons(),public.set_registration_open(uuid,boolean,integer),public.submit_registration(uuid,text,text),public.decide_registration(uuid,text,integer,text) to authenticated;
commit;
