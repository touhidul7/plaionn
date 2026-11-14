begin;

-- ============================================================================
-- Migration: 202611160024_saas_platform_fees.sql
-- Adds platform SaaS licensing plans, subscription management, per-team tiers,
-- and automated billing cycle status for commercial network expansion.
-- ============================================================================

create table if not exists public.platform_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique check(length(trim(plan_code)) >= 2),
  name text not null check(length(trim(name)) >= 2),
  monthly_price_cents integer not null default 0 check(monthly_price_cents >= 0),
  annual_price_cents integer not null default 0 check(annual_price_cents >= 0),
  per_team_fee_cents integer not null default 0 check(per_team_fee_cents >= 0),
  max_teams integer not null default 16 check(max_teams >= 4),
  video_streaming_included boolean not null default false,
  custom_domain_included boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.league_platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  plan_id uuid not null references public.platform_subscription_plans(id) on delete restrict,
  status text not null default 'active' check(status in ('trialing', 'active', 'past_due', 'canceled')),
  billing_cycle text not null default 'monthly' check(billing_cycle in ('monthly', 'annual')),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(league_id)
);

alter table public.platform_subscription_plans enable row level security;
alter table public.league_platform_subscriptions enable row level security;

grant select on public.platform_subscription_plans, public.league_platform_subscriptions to anon, authenticated;
grant all on public.platform_subscription_plans, public.league_platform_subscriptions to authenticated;

drop policy if exists plans_public_read on public.platform_subscription_plans;
create policy plans_public_read on public.platform_subscription_plans for select using (true);

drop policy if exists subs_comm_read on public.league_platform_subscriptions;
create policy subs_comm_read on public.league_platform_subscriptions for select using (
  public.is_league_commissioner(league_id)
);

drop policy if exists subs_comm_manage on public.league_platform_subscriptions;
create policy subs_comm_manage on public.league_platform_subscriptions for all to authenticated
  using (public.is_league_commissioner(league_id))
  with check (public.is_league_commissioner(league_id));

-- Seed default platform plans
insert into public.platform_subscription_plans (
  plan_code, name, monthly_price_cents, annual_price_cents, per_team_fee_cents, max_teams, video_streaming_included, custom_domain_included
)
values
  ('community', 'Community Tier', 0, 0, 0, 8, false, false),
  ('pro_league', 'Pro Circuit', 4900, 49000, 500, 24, true, true),
  ('enterprise', 'Network Franchise', 14900, 149000, 300, 64, true, true)
on conflict (plan_code) do update
set name = excluded.name,
    monthly_price_cents = excluded.monthly_price_cents,
    annual_price_cents = excluded.annual_price_cents;

-- ============================================================================
-- RPC: change_league_subscription
-- ============================================================================
create or replace function public.change_league_subscription(
  target_league uuid,
  p_plan_code text,
  p_cycle text default 'monthly'
)
returns public.league_platform_subscriptions
language plpgsql
security definer
set search_path=''
as $$
declare
  target_plan public.platform_subscription_plans;
  rec public.league_platform_subscriptions;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  select * into target_plan
  from public.platform_subscription_plans
  where plan_code = p_plan_code;

  if target_plan.id is null then
    raise exception using errcode='P0002', message='PLAN_NOT_FOUND';
  end if;

  insert into public.league_platform_subscriptions (
    league_id, plan_id, status, billing_cycle, current_period_end, updated_at
  )
  values (
    target_league, target_plan.id, 'active', coalesce(p_cycle, 'monthly'),
    case when p_cycle = 'annual' then (now() + interval '365 days') else (now() + interval '30 days') end,
    now()
  )
  on conflict (league_id) do update
  set plan_id = target_plan.id,
      billing_cycle = excluded.billing_cycle,
      status = 'active',
      updated_at = now()
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.change_league_subscription(uuid, text, text) to authenticated;

-- ============================================================================
-- RPC: get_league_platform_billing
-- ============================================================================
create or replace function public.get_league_platform_billing(target_league uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  sub_rec public.league_platform_subscriptions;
  plan_rec public.platform_subscription_plans;
  team_count bigint;
  calculated_fee_cents integer;
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  select * into sub_rec
  from public.league_platform_subscriptions
  where league_id = target_league;

  if sub_rec.id is null then
    -- Default to community plan
    select * into plan_rec from public.platform_subscription_plans where plan_code = 'community';
  else
    select * into plan_rec from public.platform_subscription_plans where id = sub_rec.plan_id;
  end if;

  select count(*) into team_count
  from public.team_entries
  where league_id = target_league;

  if sub_rec.billing_cycle = 'annual' then
    calculated_fee_cents := plan_rec.annual_price_cents + (team_count * plan_rec.per_team_fee_cents);
  else
    calculated_fee_cents := plan_rec.monthly_price_cents + (team_count * plan_rec.per_team_fee_cents);
  end if;

  return jsonb_build_object(
    'league_id', target_league,
    'plan_code', plan_rec.plan_code,
    'plan_name', plan_rec.name,
    'status', coalesce(sub_rec.status, 'active'),
    'billing_cycle', coalesce(sub_rec.billing_cycle, 'monthly'),
    'current_period_end', coalesce(sub_rec.current_period_end, now() + interval '30 days'),
    'base_price_cents', plan_rec.monthly_price_cents,
    'per_team_fee_cents', plan_rec.per_team_fee_cents,
    'active_team_count', team_count,
    'total_cycle_fee_cents', calculated_fee_cents,
    'features', jsonb_build_object(
      'max_teams', plan_rec.max_teams,
      'video_streaming', plan_rec.video_streaming_included,
      'custom_domain', plan_rec.custom_domain_included
    )
  );
end;
$$;

grant execute on function public.get_league_platform_billing(uuid) to authenticated;

commit;
