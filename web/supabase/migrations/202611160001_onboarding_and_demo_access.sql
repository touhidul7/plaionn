begin;

-- 1. Allow any authenticated user to create a new league and become its commissioner.
-- Removes the circular requirement that a user must already be a commissioner of another league.
create or replace function public.create_league(league_name text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare created_league uuid;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Sign in required';
  end if;
  if league_name is null or length(trim(league_name)) not between 2 and 100 then
    raise exception using errcode='22023',message='League name must be between 2 and 100 characters';
  end if;

  insert into public.leagues(name) values(trim(league_name)) returning id into created_league;
  insert into public.league_memberships(league_id,user_id,role)
  values(created_league,auth.uid(),'commissioner')
  on conflict do nothing;

  return created_league;
end;
$$;

revoke all on function public.create_league(text) from public,anon;
grant execute on function public.create_league(text) to authenticated;

-- 2. Allow any authenticated reviewer or client to access the PLAIONN Client Demo league as commissioner
-- without needing to manually run SQL scripts with REPLACE_WITH_CLIENT_EMAIL.
create or replace function public.join_demo_league()
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare demo_tenant constant uuid := '60000000-0000-4000-8000-000000000001';
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Sign in required';
  end if;

  if not exists(select 1 from public.leagues where id=demo_tenant) then
    raise exception using errcode='02000',message='Demo league not initialized';
  end if;

  insert into public.league_memberships(league_id,user_id,role)
  values(demo_tenant,auth.uid(),'commissioner')
  on conflict do nothing;

  return demo_tenant;
end;
$$;

revoke all on function public.join_demo_league() from public,anon;
grant execute on function public.join_demo_league() to authenticated;

commit;

