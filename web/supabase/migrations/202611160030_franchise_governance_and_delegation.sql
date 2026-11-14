begin;

-- ============================================================================
-- Migration: 202611160030_franchise_governance_and_delegation.sql
-- Adds multi-tier franchise governance models (owner, investor, operating manager,
-- facility director) with granular delegation for schedules, rosters, and finances.
-- ============================================================================

create table if not exists public.league_governance_roles (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  governance_model text not null check(governance_model in ('owner', 'investor', 'operating_manager', 'facility_director')),
  can_manage_finances boolean not null default false,
  can_manage_schedules boolean not null default true,
  can_manage_rosters boolean not null default true,
  can_transfer_ownership boolean not null default false,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id, user_id)
);

create index if not exists idx_gov_league on public.league_governance_roles(league_id);

alter table public.league_governance_roles enable row level security;

grant select on public.league_governance_roles to anon, authenticated;
grant all on public.league_governance_roles to authenticated;

drop policy if exists gov_comm_manage on public.league_governance_roles;
create policy gov_comm_manage on public.league_governance_roles for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: assign_governance_role
-- ============================================================================
create or replace function public.assign_governance_role(
  target_league uuid,
  target_user uuid,
  p_model text,
  p_finances boolean default false,
  p_schedules boolean default true,
  p_rosters boolean default true,
  p_transfer boolean default false
)
returns public.league_governance_roles
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.league_governance_roles;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if p_model not in ('owner', 'investor', 'operating_manager', 'facility_director') then
    raise exception using errcode='22023', message='Invalid governance model';
  end if;

  insert into public.league_governance_roles (
    league_id, user_id, governance_model, can_manage_finances,
    can_manage_schedules, can_manage_rosters, can_transfer_ownership,
    granted_by, updated_at
  )
  values (
    target_league, target_user, p_model, coalesce(p_finances, false),
    coalesce(p_schedules, true), coalesce(p_rosters, true), coalesce(p_transfer, false),
    auth.uid(), now()
  )
  on conflict (league_id, user_id) do update
  set governance_model = excluded.governance_model,
      can_manage_finances = excluded.can_manage_finances,
      can_manage_schedules = excluded.can_manage_schedules,
      can_manage_rosters = excluded.can_manage_rosters,
      can_transfer_ownership = excluded.can_transfer_ownership,
      updated_at = now()
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.assign_governance_role(uuid, uuid, text, boolean, boolean, boolean, boolean) to authenticated;

-- ============================================================================
-- RPC: get_league_governance_team
-- ============================================================================
create or replace function public.get_league_governance_team(target_league uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  roles_json jsonb;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role_id', g.id,
        'user_id', g.user_id,
        'email', u.email,
        'governance_model', g.governance_model,
        'can_manage_finances', g.can_manage_finances,
        'can_manage_schedules', g.can_manage_schedules,
        'can_manage_rosters', g.can_manage_rosters,
        'can_transfer_ownership', g.can_transfer_ownership,
        'assigned_at', g.created_at
      ) order by g.created_at desc
    ),
    '[]'::jsonb
  )
  into roles_json
  from public.league_governance_roles g
  join auth.users u on u.id = g.user_id
  where g.league_id = target_league;

  return jsonb_build_object(
    'league_id', target_league,
    'governance_roles', roles_json
  );
end;
$$;

grant execute on function public.get_league_governance_team(uuid) to authenticated;

commit;
