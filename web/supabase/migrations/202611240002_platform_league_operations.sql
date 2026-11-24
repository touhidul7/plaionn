begin;
-- Platform administrators use the same persisted management workflows as commissioners.
-- The platform role table is self-readable and cannot be modified by application users.
create or replace function public.is_league_member(target_league uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.league_memberships where league_id=target_league and user_id=(select auth.uid()))
    or exists(select 1 from public.platform_administrators where user_id=(select auth.uid()));
$$;
create or replace function public.is_league_commissioner(target_league uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.league_memberships where league_id=target_league and user_id=(select auth.uid()) and role='commissioner')
    or exists(select 1 from public.platform_administrators where user_id=(select auth.uid()));
$$;
commit;
