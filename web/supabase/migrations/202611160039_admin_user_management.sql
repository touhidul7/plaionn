begin;

-- ============================================================================
-- Migration: 202611160039_admin_user_management.sql
-- Enables commissioners to appoint additional commissioners, referees, timekeepers,
-- finance officers, and staff members directly by their email address,
-- list all active administrators/staff, and safely revoke access.
-- ============================================================================

-- Function 1: Add Administrator / Staff Member by Email
create or replace function public.add_league_member_by_email(
  target_league uuid,
  target_email text,
  target_role text default 'commissioner'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  found_user_id uuid;
  normalized_email text;
begin
  -- 1. Authorization: caller must be commissioner of target league
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Only league commissioners may add administrators';
  end if;

  normalized_email := lower(trim(target_email));
  if length(normalized_email) < 5 or position('@' in normalized_email) = 0 then
    raise exception using errcode='22023', message='Please enter a valid email address';
  end if;

  -- 2. Validate role
  if target_role not in ('commissioner', 'referee', 'timekeeper', 'finance', 'media', 'captain') then
    raise exception using errcode='22023', message='Invalid role specified';
  end if;

  -- 3. Lookup user by email in auth.users
  select id into found_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if found_user_id is null then
    raise exception using errcode='P0002', message='No account exists with this email address. Please ask the person to sign up first.';
  end if;

  -- 4. Insert into league_memberships
  insert into public.league_memberships (league_id, user_id, role)
  values (target_league, found_user_id, target_role)
  on conflict (league_id, user_id, role) do nothing;

  -- 5. Record security audit log
  perform public.log_security_audit_event(
    target_league,
    'add_league_member',
    'admin_management',
    jsonb_build_object(
      'appointed_email', normalized_email,
      'appointed_user_id', found_user_id,
      'role', target_role
    )
  );

  return jsonb_build_object(
    'success', true,
    'user_id', found_user_id,
    'email', normalized_email,
    'role', target_role
  );
end;
$$;

grant execute on function public.add_league_member_by_email(uuid, text, text) to authenticated;

-- Function 2: List All Staff and Administrators
create or replace function public.get_league_staff_members(target_league uuid)
returns table (
  user_id uuid,
  email text,
  role text
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Only league commissioners may view staff members';
  end if;

  return query
  select m.user_id, coalesce(u.email::text, 'Anonymous user') as email, m.role
  from public.league_memberships m
  left join auth.users u on u.id = m.user_id
  where m.league_id = target_league
    and m.role in ('commissioner', 'referee', 'timekeeper', 'finance', 'media')
  order by
    case m.role
      when 'commissioner' then 1
      when 'finance' then 2
      when 'referee' then 3
      when 'timekeeper' then 4
      when 'media' then 5
      else 6
    end,
    u.email;
end;
$$;

grant execute on function public.get_league_staff_members(uuid) to authenticated;

-- Function 3: Revoke Administrator / Staff Access
create or replace function public.remove_league_member(
  target_league uuid,
  target_user uuid,
  target_role text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  commissioner_count int;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Only league commissioners may remove staff members';
  end if;

  -- Safety rule: cannot remove yourself if you are the only commissioner remaining
  if target_role = 'commissioner' then
    select count(*) into commissioner_count
    from public.league_memberships
    where league_id = target_league and role = 'commissioner';

    if commissioner_count <= 1 then
      raise exception using errcode='22023', message='Cannot remove the only remaining commissioner. Appoint another commissioner first.';
    end if;
  end if;

  delete from public.league_memberships
  where league_id = target_league
    and user_id = target_user
    and role = target_role;

  -- Record security audit log
  perform public.log_security_audit_event(
    target_league,
    'remove_league_member',
    'admin_management',
    jsonb_build_object(
      'removed_user_id', target_user,
      'role', target_role
    )
  );

  return true;
end;
$$;

grant execute on function public.remove_league_member(uuid, uuid, text) to authenticated;

commit;
