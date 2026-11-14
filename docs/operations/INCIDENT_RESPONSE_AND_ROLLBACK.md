# Plaionn Hockey Network: Incident Response & Rollback Procedures

## 1. Incident Classification

| Severity | Definition | Response SLA | Examples |
|---|---|---|---|
| **P1 - Critical** | Platform unavailability or game sheet stoppage | < 15 mins | Database offline, live scorekeeping down on game night |
| **P2 - Major** | Invariant discrepancy or payment failure | < 1 hour | Ledger anomaly detected, scoresheet approval mismatch |
| **P3 - Minor** | Non-blocking portal defect | < 24 hours | Notification delayed, cosmetic styling glitch |

## 2. Emergency Operational Controls
- **Read-Only Mode:** If database state integrity is questioned, disable game sheet submission RPCs while leaving public scoreboard readable.
- **Rollback Sequence:**
  1. Frontend deployment: Revert Next.js Vercel/container deployment to previous verified build tag.
  2. Database migration rollback: Apply designated rollback migration script or initiate point-in-time recovery.
  3. Re-run test suite:
     ```bash
     node --test web/tests/pilot-e2e-cycle.test.mjs
     ```

## 3. Support Ownership Matrix
- **Platform Infrastructure & Database:** Lead Systems Engineer
- **Commissioner Operations & Roster Eligibility:** League Support Desk
- **On-Ice Game Sheet & Officials:** Chief Referee / Head Timekeeper
- **Escalation Contact:** ops@plaionn.com
