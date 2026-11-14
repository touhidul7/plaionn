# Plaionn Hockey Network: Backup and Disaster Recovery Runbook

## 1. Overview
This runbook defines the backup frequency, retention windows, and restoration procedures for the Plaionn Hockey Network multi-tenant platform.

## 2. Backup Architecture & Policies
- **Database Engine:** Supabase PostgreSQL with Point-in-Time Recovery (PITR).
- **Physical Snapshots:** Daily automated base backups taken at 03:00 UTC with 30-day retention.
- **Continuous Write-Ahead Logging (WAL):** Continuous archiving enabling recovery to any second within the retention window.
- **Storage Objects:** Immutable document storage for league waivers and player releases in private encrypted buckets (`league-documents`).

## 3. Restoration Procedure
### Step 1: Incident Assessment & Freeze
1. Place platform in maintenance mode if active data corruption is detected.
2. Identify the target restore timestamp prior to the corruption event.

### Step 2: Supabase Point-in-Time Restoration
1. Initiate PITR restore to an isolated staging replica or target instance.
2. Run automated validation suite:
   ```bash
   node --test web/tests/pilot-e2e-cycle.test.mjs
   node --test web/tests/system-health.test.mjs
   ```

### Step 3: Ledger & Game Sheet Invariant Audit
1. Execute the system health audit to verify financial and scoresheet invariants:
   ```sql
   select public.check_league_system_health('<league_id>');
   ```
2. Verify `ledger_invariants.anomalies_detected = 0` and `ledger_invariants.is_balanced = true`.

### Step 4: DNS / Environment Promotion
1. Update `NEXT_PUBLIC_SUPABASE_URL` and service keys in production environment.
2. Complete smoke test verification and reopen public access.
