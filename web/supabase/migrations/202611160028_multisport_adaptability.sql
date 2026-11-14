begin;

-- ============================================================================
-- Migration: 202611160028_multisport_adaptability.sql
-- Adds configurable sport profiles (Ice Hockey, Ball/Dek Hockey, Roller Hockey,
-- Lacrosse, Ringette) with period formats, scoring terms, and position sets.
-- ============================================================================

create table if not exists public.sport_configurations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  sport_type text not null default 'ice_hockey' check(sport_type in ('ice_hockey', 'ball_hockey', 'roller_hockey', 'lacrosse', 'ringette')),
  sport_display_name text not null default 'Ice Hockey',
  period_format text not null default '3_periods' check(period_format in ('3_periods', '2_halves', '4_quarters')),
  period_duration_minutes integer not null default 20 check(period_duration_minutes between 5 and 60),
  scoring_unit_name text not null default 'Goal',
  assist_tracking_enabled boolean not null default true,
  penalty_tracking_enabled boolean not null default true,
  allowed_positions text[] not null default array['C', 'LW', 'RW', 'D', 'G', 'F'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id)
);

alter table public.sport_configurations enable row level security;

grant select on public.sport_configurations to anon, authenticated;
grant all on public.sport_configurations to authenticated;

drop policy if exists sport_config_read on public.sport_configurations;
create policy sport_config_read on public.sport_configurations for select using (true);

drop policy if exists sport_config_comm on public.sport_configurations;
create policy sport_config_comm on public.sport_configurations for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- ============================================================================
-- RPC: update_league_sport_config
-- ============================================================================
create or replace function public.update_league_sport_config(
  target_league uuid,
  p_sport_type text default 'ice_hockey',
  p_period_format text default '3_periods',
  p_period_duration integer default 20,
  p_positions text[] default null
)
returns public.sport_configurations
language plpgsql
security definer
set search_path=''
as $$
declare
  disp_name text;
  unit_name text;
  pos_array text[];
  rec public.sport_configurations;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  if p_sport_type = 'ball_hockey' then
    disp_name := 'Ball / Dek Hockey';
    unit_name := 'Goal';
    pos_array := coalesce(p_positions, array['F', 'D', 'G', 'C', 'LW', 'RW']);
  elsif p_sport_type = 'roller_hockey' then
    disp_name := 'Inline Roller Hockey';
    unit_name := 'Goal';
    pos_array := coalesce(p_positions, array['F', 'D', 'G']);
  elsif p_sport_type = 'lacrosse' then
    disp_name := 'Box Lacrosse';
    unit_name := 'Goal';
    pos_array := coalesce(p_positions, array['Attack', 'Midfield', 'Defense', 'Goalie']);
  elsif p_sport_type = 'ringette' then
    disp_name := 'Ringette';
    unit_name := 'Goal';
    pos_array := coalesce(p_positions, array['Center', 'Forward', 'Defense', 'Goalie']);
  else
    p_sport_type := 'ice_hockey';
    disp_name := 'Ice Hockey';
    unit_name := 'Goal';
    pos_array := coalesce(p_positions, array['C', 'LW', 'RW', 'D', 'G', 'F']);
  end if;

  insert into public.sport_configurations (
    league_id, sport_type, sport_display_name, period_format, period_duration_minutes,
    scoring_unit_name, allowed_positions, updated_at
  )
  values (
    target_league, p_sport_type, disp_name, coalesce(p_period_format, '3_periods'),
    coalesce(p_period_duration, 20), unit_name, pos_array, now()
  )
  on conflict (league_id) do update
  set sport_type = excluded.sport_type,
      sport_display_name = excluded.sport_display_name,
      period_format = excluded.period_format,
      period_duration_minutes = excluded.period_duration_minutes,
      scoring_unit_name = excluded.scoring_unit_name,
      allowed_positions = excluded.allowed_positions,
      updated_at = now()
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.update_league_sport_config(uuid, text, text, integer, text[]) to authenticated;

-- ============================================================================
-- RPC: get_league_sport_config
-- ============================================================================
create or replace function public.get_league_sport_config(target_league uuid)
returns public.sport_configurations
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  rec public.sport_configurations;
begin
  select * into rec
  from public.sport_configurations
  where league_id = target_league;

  if rec.id is null then
    -- Return default Ice Hockey configuration
    return (
      gen_random_uuid(),
      target_league,
      'ice_hockey',
      'Ice Hockey',
      '3_periods',
      20,
      'Goal',
      true,
      true,
      array['C', 'LW', 'RW', 'D', 'G', 'F'],
      now(),
      now()
    )::public.sport_configurations;
  end if;

  return rec;
end;
$$;

grant execute on function public.get_league_sport_config(uuid) to anon, authenticated;

commit;
