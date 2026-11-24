begin;

create table public.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin'))
);
alter table public.platform_administrators enable row level security;
grant select on public.platform_administrators to authenticated;
create policy platform_admin_self_read on public.platform_administrators
  for select to authenticated using (user_id = auth.uid());

-- Preserve only the two explicitly configured platform owners, never email substrings.
insert into public.platform_administrators(user_id, role)
select id, 'super_admin' from auth.users where id in (
  '27739759-8e9a-4cfc-a702-bdd5dbd8bf48'::uuid,
  '9b1123d6-8afa-4bcd-9d8e-b794a3a251bb'::uuid
);

create table public.admin_league_settings (
  league_id uuid primary key references public.leagues(id),
  domain text not null unique,
  season text not null,
  commissioner_email text not null,
  legacy_id text unique
);
alter table public.admin_league_settings enable row level security;
grant select on public.admin_league_settings to authenticated;
create policy admin_league_settings_read on public.admin_league_settings
  for select to authenticated using (public.is_league_commissioner(league_id));

grant all on public.platform_administrators, public.admin_league_settings to service_role;

-- A server-only transaction keeps the league and its assignment together.
create function public.provision_admin_league(
  league_name text, league_domain text, season_name text,
  commissioner_id uuid, commissioner_email text, legacy_id text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if legacy_id is not null then
    perform pg_advisory_xact_lock(hashtext(legacy_id));
    select s.league_id into target_id from public.admin_league_settings s
      where s.legacy_id = provision_admin_league.legacy_id;
    if target_id is not null then return target_id; end if;
  end if;
  insert into public.leagues(name) values (league_name) returning id into target_id;
  insert into public.league_memberships(league_id,user_id,role)
    values (target_id, commissioner_id, 'commissioner');
  insert into public.admin_league_settings values
    (target_id, league_domain, season_name, lower(commissioner_email), legacy_id);
  insert into public.seasons(league_id,name) values (target_id,season_name);
  return target_id;
end;
$$;
revoke all on function public.provision_admin_league(text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.provision_admin_league(text,text,text,uuid,text,text) to service_role;
commit;
