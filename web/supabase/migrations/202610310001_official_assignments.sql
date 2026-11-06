begin;
create table public.game_officials (
 game_id uuid not null references public.games(id),
 league_id uuid not null references public.leagues(id),
 slot text not null check(slot in ('timekeeper','referee_1','referee_2')),
 user_id uuid not null,
 role text not null check(role in ('timekeeper','referee')),
 primary key(game_id,slot), unique(game_id,user_id),
 foreign key(league_id,user_id,role) references public.league_memberships(league_id,user_id,role),
 check(role=case when slot='timekeeper' then 'timekeeper' else 'referee' end)
);
create table public.official_assignment_audit (
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references public.leagues(id),game_id uuid not null references public.games(id),
 actor_id uuid not null references auth.users(id),changed_at timestamptz not null default now(),
 reason text not null,previous_record jsonb,new_record jsonb
);
alter table public.game_officials enable row level security;
alter table public.official_assignment_audit enable row level security;
revoke all on public.game_officials,public.official_assignment_audit from anon,authenticated;
grant select on public.game_officials,public.official_assignment_audit to authenticated;
create policy officials_read on public.game_officials for select to authenticated using (
 public.is_league_commissioner(league_id) or (user_id=auth.uid() and public.is_league_member(league_id)
 and exists(select 1 from public.games g where g.id=game_id and g.status<>'draft'))
);
create policy officials_audit_read on public.official_assignment_audit for select to authenticated using(public.is_league_commissioner(league_id));

-- Only commissioners may see the eligible officials directory, including contact email.
create function public.list_league_officials(target_league uuid)
returns table(user_id uuid,role text,label text) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 return query select m.user_id,m.role,coalesce(nullif(u.email,''),m.user_id::text)
 from public.league_memberships m join auth.users u on u.id=m.user_id
 where m.league_id=target_league and m.role in ('timekeeper','referee') order by 3,2;
end; $$;

-- Schedule writes already lock the league row. A shared transaction lock also
-- serializes official booking checks across leagues; never exposes other fixtures.
create function public.check_game_official_conflicts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(72631001);
 if new.status<>'cancelled' and exists(
 select 1 from public.game_officials own_assignment
 join public.game_officials other_assignment on other_assignment.user_id=own_assignment.user_id and other_assignment.game_id<>new.id
 join public.games g on g.id=other_assignment.game_id
 where own_assignment.game_id=new.id and g.status<>'cancelled' and g.starts_at<new.ends_at and g.ends_at>new.starts_at
 ) then raise exception using errcode='P0001',message='OFFICIAL_CONFLICT'; end if;
 return new;
end; $$;
create trigger game_official_conflicts before update of starts_at,ends_at,status on public.games
for each row execute function public.check_game_official_conflicts();

create function public.save_game_official(target_game uuid,target_league uuid,target_slot text,target_user uuid,expected_revision integer,change_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare fixture public.games; previous public.game_officials; saved public.game_officials; required_role text;
begin
 if auth.uid() is null or not public.is_league_commissioner(target_league) then raise exception using errcode='42501',message='Commissioner access required'; end if;
 perform 1 from public.leagues where id=target_league for update;
 perform pg_catalog.pg_advisory_xact_lock(72631001);
 select * into fixture from public.games where id=target_game and league_id=target_league;
 if fixture.id is null then raise exception using errcode='42501',message='Game unavailable'; end if;
 if expected_revision is null or expected_revision<>fixture.revision then raise exception using errcode='P0001',message='GAME_STALE'; end if;
 if target_slot is null or target_slot not in ('timekeeper','referee_1','referee_2') then raise exception using errcode='22023',message='Invalid official slot'; end if;
 if change_reason is null or length(trim(change_reason)) not between 3 and 500 then raise exception using errcode='22023',message='CHANGE_REASON_REQUIRED'; end if;
 required_role=case when target_slot='timekeeper' then 'timekeeper' else 'referee' end;
 select * into previous from public.game_officials where game_id=target_game and slot=target_slot;
 if target_user is not null then
  if fixture.status='cancelled' then raise exception using errcode='22023',message='GAME_CANCELLED'; end if;
  if not exists(select 1 from public.league_memberships where league_id=target_league and user_id=target_user and role=required_role)
  then raise exception using errcode='22023',message='OFFICIAL_ROLE_REQUIRED'; end if;
  if exists(select 1 from public.game_officials where game_id=target_game and user_id=target_user and slot<>target_slot)
  then raise exception using errcode='P0001',message='OFFICIAL_DUPLICATE'; end if;
  if exists(select 1 from public.game_officials a join public.games g on g.id=a.game_id
   where a.user_id=target_user and g.id<>target_game and g.status<>'cancelled'
   and g.starts_at<fixture.ends_at and g.ends_at>fixture.starts_at)
  then raise exception using errcode='P0001',message='OFFICIAL_CONFLICT'; end if;
  insert into public.game_officials(game_id,league_id,slot,user_id,role) values(target_game,target_league,target_slot,target_user,required_role)
  on conflict(game_id,slot) do update set user_id=excluded.user_id,role=excluded.role returning * into saved;
 else
  delete from public.game_officials where game_id=target_game and slot=target_slot;
 end if;
 update public.games set revision=revision+1 where id=target_game;
 insert into public.official_assignment_audit(league_id,game_id,actor_id,reason,previous_record,new_record)
 values(target_league,target_game,auth.uid(),trim(change_reason),
 case when previous.game_id is null then null else to_jsonb(previous) end,
 case when saved.game_id is null then null else to_jsonb(saved) end);
 return fixture.revision+1;
end; $$;
revoke all on function public.list_league_officials(uuid),public.save_game_official(uuid,uuid,text,uuid,integer,text),public.check_game_official_conflicts() from public,anon,authenticated;
grant execute on function public.list_league_officials(uuid),public.save_game_official(uuid,uuid,text,uuid,integer,text) to authenticated;
commit;
