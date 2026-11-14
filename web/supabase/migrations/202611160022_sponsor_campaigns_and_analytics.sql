begin;

-- ============================================================================
-- Migration: 202611160022_sponsor_campaigns_and_analytics.sql
-- Adds sponsor impression and click tracking with CTR calculation,
-- automated metrics aggregation, and commissioner campaign ROI reporting.
-- ============================================================================

create table if not exists public.sponsor_interactions (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.league_sponsors(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  interaction_type text not null check(interaction_type in ('impression', 'click')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sponsor_interactions on public.sponsor_interactions(sponsor_id, interaction_type);
create index if not exists idx_sponsor_interactions_league on public.sponsor_interactions(league_id, created_at);

alter table public.sponsor_interactions enable row level security;

grant select on public.sponsor_interactions to anon, authenticated;
grant all on public.sponsor_interactions to authenticated;

drop policy if exists sponsor_interactions_read on public.sponsor_interactions;
create policy sponsor_interactions_read on public.sponsor_interactions for select using (
  public.is_league_commissioner(league_id)
);

drop policy if exists sponsor_interactions_insert on public.sponsor_interactions;
create policy sponsor_interactions_insert on public.sponsor_interactions for insert with check (true);

-- ============================================================================
-- RPC: track_sponsor_interaction
-- ============================================================================
create or replace function public.track_sponsor_interaction(
  target_sponsor uuid,
  p_interaction_type text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  target_league uuid;
begin
  if p_interaction_type not in ('impression', 'click') then
    raise exception using errcode='22023', message='Interaction type must be impression or click';
  end if;

  select league_id into target_league
  from public.league_sponsors
  where id = target_sponsor;

  if target_league is null then
    raise exception using errcode='P0002', message='SPONSOR_NOT_FOUND';
  end if;

  insert into public.sponsor_interactions (
    sponsor_id, league_id, interaction_type, user_id
  )
  values (
    target_sponsor, target_league, p_interaction_type, auth.uid()
  );

  return true;
end;
$$;

grant execute on function public.track_sponsor_interaction(uuid, text) to anon, authenticated;

-- ============================================================================
-- RPC: get_sponsor_campaign_report
-- ============================================================================
create or replace function public.get_sponsor_campaign_report(target_league uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  report_json jsonb;
  total_impressions bigint;
  total_clicks bigint;
  overall_ctr numeric(5,2);
begin
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode='42501', message='Commissioner access required';
  end if;

  with sponsor_metrics as (
    select
      s.id as sponsor_id,
      s.name,
      s.placement_tier,
      s.website_url,
      s.is_active,
      count(si.id) filter (where si.interaction_type = 'impression') as impressions,
      count(si.id) filter (where si.interaction_type = 'click') as clicks
    from public.league_sponsors s
    left join public.sponsor_interactions si on si.sponsor_id = s.id
    where s.league_id = target_league
    group by s.id, s.name, s.placement_tier, s.website_url, s.is_active
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sponsor_id', sponsor_id,
        'name', name,
        'tier', placement_tier,
        'url', website_url,
        'is_active', is_active,
        'impressions', impressions,
        'clicks', clicks,
        'ctr_pct', case when impressions > 0 then round(((clicks::numeric / impressions::numeric) * 100.0), 2) else 0.00 end
      ) order by impressions desc, clicks desc
    ),
    '[]'::jsonb
  )
  into report_json
  from sponsor_metrics;

  select
    count(*) filter (where interaction_type = 'impression'),
    count(*) filter (where interaction_type = 'click')
  into total_impressions, total_clicks
  from public.sponsor_interactions
  where league_id = target_league;

  if total_impressions > 0 then
    overall_ctr := round(((total_clicks::numeric / total_impressions::numeric) * 100.0), 2);
  else
    overall_ctr := 0.00;
  end if;

  return jsonb_build_object(
    'league_id', target_league,
    'total_impressions', total_impressions,
    'total_clicks', total_clicks,
    'overall_ctr_pct', overall_ctr,
    'sponsors', report_json
  );
end;
$$;

grant execute on function public.get_sponsor_campaign_report(uuid) to authenticated;

commit;
