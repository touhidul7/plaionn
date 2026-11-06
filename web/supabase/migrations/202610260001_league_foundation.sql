-- Apply to a new Supabase development project. No user is automatically made an administrator.
begin;
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 2 and 100),
  created_at timestamptz not null default now()
);
create table public.league_memberships (
  league_id uuid not null references public.leagues(id),
  user_id uuid not null references auth.users(id),
  role text not null check(role in ('commissioner','captain','player','timekeeper','referee','finance','media')),
  primary key(league_id, user_id, role)
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  name text not null check(length(trim(name)) between 2 and 100),
  unique(id, league_id)
);
create unique index seasons_name_unique on public.seasons(league_id, lower(name));
create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  season_id uuid not null,
  name text not null check(length(trim(name)) between 2 and 100),
  foreign key(season_id, league_id) references public.seasons(id, league_id),
  unique(id, league_id)
);
create unique index divisions_name_unique on public.divisions(season_id, lower(name));
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  name text not null check(length(trim(name)) between 2 and 100),
  unique(id, league_id)
);
create unique index teams_name_unique on public.teams(league_id, lower(name));
create table public.team_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  team_id uuid not null,
  division_id uuid not null,
  foreign key(team_id, league_id) references public.teams(id, league_id),
  foreign key(division_id, league_id) references public.divisions(id, league_id),
  unique(team_id, division_id)
);

-- Memberships are readable only by their user. No application role can grant itself membership.
alter table public.league_memberships enable row level security;
create policy membership_self_read on public.league_memberships for select to authenticated
  using(user_id=(select auth.uid()));
revoke all on public.league_memberships from anon, authenticated;
grant select on public.league_memberships to authenticated;

-- Security-invoker helpers respect membership RLS and cannot bypass it.
create function public.is_league_member(target_league uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select exists(select 1 from public.league_memberships
  where league_id=target_league and user_id=(select auth.uid())); $$;
create function public.is_league_commissioner(target_league uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select exists(select 1 from public.league_memberships
  where league_id=target_league and user_id=(select auth.uid()) and role='commissioner'); $$;
revoke all on function public.is_league_member(uuid) from public, anon;
revoke all on function public.is_league_commissioner(uuid) from public, anon;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_commissioner(uuid) to authenticated;

alter table public.leagues enable row level security;
alter table public.seasons enable row level security;
alter table public.divisions enable row level security;
alter table public.teams enable row level security;
alter table public.team_entries enable row level security;
revoke all on public.leagues, public.seasons, public.divisions, public.teams, public.team_entries from anon, authenticated;
grant select on public.leagues, public.seasons, public.divisions, public.teams, public.team_entries to authenticated;
grant insert on public.seasons, public.divisions, public.teams, public.team_entries to authenticated;

create policy league_read on public.leagues for select to authenticated using(public.is_league_member(id));
create policy seasons_read on public.seasons for select to authenticated using(public.is_league_member(league_id));
create policy divisions_read on public.divisions for select to authenticated using(public.is_league_member(league_id));
create policy teams_read on public.teams for select to authenticated using(public.is_league_member(league_id));
create policy entries_read on public.team_entries for select to authenticated using(public.is_league_member(league_id));
create policy seasons_create on public.seasons for insert to authenticated with check(public.is_league_commissioner(league_id));
create policy divisions_create on public.divisions for insert to authenticated with check(public.is_league_commissioner(league_id));
create policy teams_create on public.teams for insert to authenticated with check(public.is_league_commissioner(league_id));
create policy entries_create on public.team_entries for insert to authenticated with check(public.is_league_commissioner(league_id));

-- One atomic call prevents orphan teams when the entry fails.
create function public.create_team_with_entry(target_league uuid, target_division uuid, team_name text)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare new_team uuid;
begin
  insert into public.teams(league_id,name) values(target_league,trim(team_name)) returning id into new_team;
  insert into public.team_entries(league_id,team_id,division_id) values(target_league,new_team,target_division);
  return new_team;
end; $$;
revoke all on function public.create_team_with_entry(uuid,uuid,text) from public, anon;
grant execute on function public.create_team_with_entry(uuid,uuid,text) to authenticated;

insert into public.leagues(id,name)
values('00000000-0000-4000-8000-000000000001','PLAIONN Test Hockey League');
commit;

