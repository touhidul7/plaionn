begin;

create function public.create_league(league_name text)
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
  if not exists(
    select 1 from public.league_memberships
    where user_id=auth.uid() and role='commissioner'
  ) then
    raise exception using errcode='42501',message='Commissioner membership required';
  end if;

  insert into public.leagues(name) values(trim(league_name)) returning id into created_league;
  insert into public.league_memberships(league_id,user_id,role)
  values(created_league,auth.uid(),'commissioner');
  return created_league;
end;
$$;

revoke all on function public.create_league(text) from public,anon,authenticated;
grant execute on function public.create_league(text) to authenticated;

commit;
