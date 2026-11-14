begin;

-- ============================================================================
-- Migration: 202611160036_system_health_and_integrity_audit.sql
-- Operational Health Monitor, Financial Ledger Invariants, and Roster Audit
-- ============================================================================

create or replace function public.check_league_system_health(target_league uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_comm boolean;
  ledger_total_invoices integer;
  ledger_billed_cents bigint;
  ledger_collected_cents bigint;
  ledger_anomalies integer;
  games_total integer;
  games_pending_approval integer;
  games_overdue integer;
  roster_active_players integer;
  roster_pending_registrations integer;
  overall_status text := 'healthy';
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select public.is_league_commissioner(target_league) into is_comm;
  if not coalesce(is_comm, false) then
    raise exception 'Commissioner permissions required to run league health check.';
  end if;

  -- 1. Financial Ledger Invariant Check
  select
    coalesce(count(*), 0),
    coalesce(sum(amount_cents), 0),
    coalesce(sum(amount_paid_cents), 0),
    coalesce(count(*) filter (where amount_paid_cents > amount_cents), 0)
  into
    ledger_total_invoices,
    ledger_billed_cents,
    ledger_collected_cents,
    ledger_anomalies
  from public.league_invoices
  where league_id = target_league;

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

  -- Evaluate Overall Health Status
  if ledger_anomalies > 0 then
    overall_status := 'critical';
  elsif games_pending_approval > 0 or games_overdue > 0 or roster_pending_registrations > 0 then
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
    )
  );
end;
$$;

grant execute on function public.check_league_system_health to authenticated;

commit;
