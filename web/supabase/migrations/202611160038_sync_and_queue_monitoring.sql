begin;

-- ============================================================================
-- Migration: 202611160038_sync_and_queue_monitoring.sql
-- Queue, Webhook / Notification Delivery, and Offline Sync Health Monitoring
-- ============================================================================

create or replace function public.check_league_system_health(target_league uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_billed_cents bigint := 0;
  ledger_collected_cents bigint := 0;
  ledger_anomalies integer := 0;
  ledger_total_invoices integer := 0;

  games_total integer := 0;
  games_pending_approval integer := 0;
  games_overdue integer := 0;

  roster_active_players integer := 0;
  roster_pending_registrations integer := 0;

  queue_failed_count integer := 0;
  queue_pending_count integer := 0;
  queue_quiet_hours_held integer := 0;
  recent_synced_events integer := 0;

  overall_status text := 'healthy';
begin
  -- 0. Authorization Guard
  if auth.uid() is null or not public.is_league_commissioner(target_league) then
    raise exception using errcode = '42501', message = 'Commissioner permissions required.';
  end if;

  -- 1. Financial Ledger Invariant Audit
  select
    coalesce(count(*), 0),
    coalesce(sum(amount_cents), 0),
    coalesce(sum(amount_paid_cents), 0),
    coalesce(count(*) filter (
      where amount_paid_cents > amount_cents
         or (status = 'paid' and amount_paid_cents <> amount_cents)
         or (status = 'issued' and amount_paid_cents <> 0)
    ), 0)
  into
    ledger_total_invoices,
    ledger_billed_cents,
    ledger_collected_cents,
    ledger_anomalies
  from public.league_invoices
  where league_id = target_league and status <> 'void';

  -- 2. Game Sheet & Scoring Integrity Check
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (
      where status = 'completed'
        and not exists (
          select 1 from public.game_results gr
          where gr.game_id = g.id and gr.status = 'approved'
        )
    ), 0),
    coalesce(count(*) filter (
      where status = 'scheduled'
        and starts_at < (now() - interval '4 hours')
    ), 0)
  into
    games_total,
    games_pending_approval,
    games_overdue
  from public.games g
  where g.league_id = target_league;

  -- 3. Roster & Registration Invariant Check
  select coalesce(count(distinct player_id), 0)
  into roster_active_players
  from public.roster_memberships
  where league_id = target_league and status = 'active';

  select coalesce(count(*), 0)
  into roster_pending_registrations
  from public.player_registrations
  where league_id = target_league and status = 'pending';

  -- 4. Queue, Notification Dispatch & Sync Lag Monitoring
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'notification_deliveries') then
    select
      coalesce(count(*) filter (where status = 'failed'), 0),
      coalesce(count(*) filter (where status = 'pending'), 0),
      coalesce(count(*) filter (where status = 'suppressed_quiet_hours'), 0)
    into
      queue_failed_count,
      queue_pending_count,
      queue_quiet_hours_held
    from public.notification_deliveries
    where league_id = target_league;
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'game_events') then
    select coalesce(count(*), 0)
    into recent_synced_events
    from public.game_events
    where league_id = target_league
      and recorded_at >= (now() - interval '24 hours');
  end if;

  -- Evaluate Overall Health Status
  if ledger_anomalies > 0 or queue_failed_count > 5 then
    overall_status := 'critical';
  elsif games_pending_approval > 0 or games_overdue > 0 or roster_pending_registrations > 0 or queue_failed_count > 0 then
    overall_status := 'attention_required';
  else
    overall_status := 'healthy';
  end if;

  return jsonb_build_object(
    'league_id', target_league,
    'overall_status', overall_status,
    'checked_at', now(),
    'ledger_invariants', jsonb_build_object(
      'total_invoices', ledger_total_invoices,
      'total_billed_cents', ledger_billed_cents,
      'total_collected_cents', ledger_collected_cents,
      'outstanding_balance_cents', (ledger_billed_cents - ledger_collected_cents),
      'anomalies_detected', ledger_anomalies,
      'is_balanced', (ledger_anomalies = 0)
    ),
    'game_sheet_integrity', jsonb_build_object(
      'total_games', games_total,
      'pending_official_approvals', games_pending_approval,
      'overdue_unscored_games', games_overdue
    ),
    'roster_compliance', jsonb_build_object(
      'active_rostered_players', roster_active_players,
      'pending_registrations', roster_pending_registrations
    ),
    'queue_and_sync_health', jsonb_build_object(
      'failed_deliveries', queue_failed_count,
      'pending_in_queue', queue_pending_count,
      'quiet_hours_held', queue_quiet_hours_held,
      'recent_synced_events', recent_synced_events
    )
  );
end;
$$;

revoke all on function public.check_league_system_health(uuid) from public, anon;
grant execute on function public.check_league_system_health(uuid) to authenticated;

commit;
