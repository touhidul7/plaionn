begin;

-- ============================================================================
-- Migration: 202611160019_crm_and_retention_analytics.sql
-- Adds league support waitlists (team & individual) with status lifecycle,
-- plus season-over-season player return rate & churn retention analytics.
-- ============================================================================

create table if not exists public.division_waitlists (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete set null,
  waitlist_type text not null check(waitlist_type in ('team', 'individual_player')),
  applicant_name text not null check(length(trim(applicant_name)) between 2 and 100),
  contact_email text not null check(contact_email like '%@%'),
  contact_phone text,
  skill_level text,
  preferred_positions text[],
  status text not null default 'pending' check(status in ('pending', 'offered', 'accepted', 'declined', 'cancelled')),
  notes text,
  priority_score integer not null default 100,
  offered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_waitlist_league on public.division_waitlists(league_id, status);

alter table public.division_waitlists enable row level security;

grant select on public.division_waitlists to anon, authenticated;
grant all on public.division_waitlists to authenticated;

drop policy if exists waitlist_public_create on public.division_waitlists;
create policy waitlist_public_create on public.division_waitlists for insert with check (true);

drop policy if exists waitlist_comm_all on public.division_waitlists;
create policy waitlist_comm_all on public.division_waitlists for all
  to authenticated using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: join_division_waitlist
-- ============================================================================
create or replace function public.join_division_waitlist(
  target_league uuid,
  p_type text,
  p_name text,
  p_email text,
  p_division_id uuid default null,
  p_phone text default null,
  p_skill text default null,
  p_positions text[] default null,
  p_notes text default null
)
returns public.division_waitlists
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.division_waitlists;
begin
  if p_type not in ('team', 'individual_player') then
    raise exception using errcode='22023', message='Waitlist type must be team or individual_player';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception using errcode='22023', message='Applicant name is required';
  end if;

  if p_email is null or p_email not like '%@%' then
    raise exception using errcode='22023', message='Valid email address is required';
  end if;

  insert into public.division_waitlists (
    league_id, division_id, waitlist_type, applicant_name, contact_email,
    contact_phone, skill_level, preferred_positions, notes
  )
  values (
    target_league, p_division_id, p_type, trim(p_name), lower(trim(p_email)),
    nullif(trim(p_phone), ''), nullif(trim(p_skill), ''), p_positions, nullif(trim(p_notes), '')
  )
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.join_division_waitlist(uuid, text, text, text, uuid, text, text, text[], text) to anon, authenticated;

-- ============================================================================
-- RPC: manage_waitlist_status
-- ============================================================================
create or replace function public.manage_waitlist_status(
  target_entry_id uuid,
  new_status text,
  admin_notes text default null
)
returns public.division_waitlists
language plpgsql
security definer
set search_path=''
as $$
declare
  rec public.division_waitlists;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  select * into rec
  from public.division_waitlists
  where id = target_entry_id
  for update;

  if rec.id is null then
    raise exception using errcode='P0002', message='WAITLIST_ENTRY_NOT_FOUND';
  end if;

  if not public.is_league_commissioner(rec.league_id) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if new_status not in ('pending', 'offered', 'accepted', 'declined', 'cancelled') then
    raise exception using errcode='22023', message='Invalid status transition';
  end if;

  update public.division_waitlists
  set status = new_status,
      notes = coalesce(admin_notes, notes),
      offered_at = case when new_status = 'offered' then now() else offered_at end,
      updated_at = now()
  where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.manage_waitlist_status(uuid, text, text) to authenticated;

-- ============================================================================
-- RPC: get_league_retention_analytics
-- Calculates season-over-season player return rate and list of churned players
-- ============================================================================
create or replace function public.get_league_retention_analytics(
  target_league uuid,
  base_season_id uuid,
  compare_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base_count bigint;
  compare_count bigint;
  returning_count bigint;
  churned_count bigint;
  new_count bigint;
  retention_rate numeric(5,2);
  churned_sample jsonb;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  -- 1. Base season players
  with base_rosters as (
    select distinct
      rm.player_id,
      p.display_name,
      t.name as team_name
    from public.roster_memberships rm
    join public.players p on p.id = rm.player_id
    join public.team_entries te on te.id = rm.team_entry_id and te.league_id = target_league
    join public.teams t on t.id = te.team_id
    join public.divisions d on d.id = te.division_id and d.league_id = target_league
    where d.season_id = base_season_id and rm.status = 'active'
  ),
  -- 2. Compare season players
  compare_rosters as (
    select distinct
      rm.player_id
    from public.roster_memberships rm
    join public.team_entries te on te.id = rm.team_entry_id and te.league_id = target_league
    join public.divisions d on d.id = te.division_id and d.league_id = target_league
    where d.season_id = compare_season_id and rm.status = 'active'
  ),
  retention_join as (
    select
      br.player_id,
      br.display_name,
      br.team_name,
      case when cr.player_id is not null then true else false end as has_returned
    from base_rosters br
    left join compare_rosters cr on cr.player_id = br.player_id
  )
  select
    count(*),
    count(*) filter (where has_returned = true),
    count(*) filter (where has_returned = false),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'player_id', player_id,
          'display_name', display_name,
          'last_team', team_name
        )
      ) filter (where has_returned = false),
      '[]'::jsonb
    )
  into base_count, returning_count, churned_count, churned_sample
  from retention_join;

  select count(distinct rm.player_id) into compare_count
  from public.roster_memberships rm
  join public.team_entries te on te.id = rm.team_entry_id and te.league_id = target_league
  join public.divisions d on d.id = te.division_id and d.league_id = target_league
  where d.season_id = compare_season_id and rm.status = 'active';

  new_count := greatest(0, compare_count - returning_count);

  if base_count > 0 then
    retention_rate := round(((returning_count::numeric / base_count::numeric) * 100.0), 2);
  else
    retention_rate := 0.00;
  end if;

  return jsonb_build_object(
    'target_league', target_league,
    'base_season_id', base_season_id,
    'compare_season_id', compare_season_id,
    'base_season_players', base_count,
    'compare_season_players', compare_count,
    'returning_players', returning_count,
    'churned_players_count', churned_count,
    'new_players_count', new_count,
    'retention_rate_pct', retention_rate,
    'churned_sample', churned_sample
  );
end;
$$;

grant execute on function public.get_league_retention_analytics(uuid, uuid, uuid) to authenticated;

commit;
