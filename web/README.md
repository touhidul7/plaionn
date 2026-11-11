# Current deployment review - 2026-11-09

Client preview setup: [Vercel deployment guide](../VERCEL_DEPLOYMENT.md), [client walkthrough](../CLIENT_TEST_GUIDE.md), [review findings](../APP_REVIEW_2026-11-06.md).

The hosted schema checker was rerun on 2026-11-09 after the user-reported migrations: Auth HTTP 200; all 34 expected private tables exist and deny anonymous access. Authenticated workflows still need verification. The existing Client Demo is persistent seed data, not real league data.

# PLAIONN Hockey — Phase 1 application

Next.js/TypeScript application with Supabase authentication and league storage. Phase 1 remains incomplete and is not ready for public launch.

## Run

Requires Node.js 22+ and npm. From web/:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:3000/login. The development server binds only to loopback.

Configure the matching Project URL and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_`) or `NEXT_PUBLIC_ANON_KEY` (legacy anon JWT, role `anon`) in ignored .env.local. Never use a secret/service-role key. See .env.example for variable names. Set NEXT_PUBLIC_APP_URL to the application's origin (development default: http://127.0.0.1:3000).

## Supabase setup required

Follow [Supabase setup](supabase/README.md) to apply the schema, restore the existing test team, configure confirmation redirects, and grant the intended test account a commissioner membership.

The historical public-key probe (2026-11-09) found 23/26 tables before schedule inventory was added; the latest checker run found 34/34 expected private tables. See migration status in [Supabase setup](supabase/README.md).

The app no longer reads or writes local PGlite data. It uses authenticated Supabase queries and RLS, and does not fall back to local storage on a failed request. The original local database remains untouched for recovery.

## Current functionality

- Scheduling at /schedule: commissioner venue/rink and division-scoped ice-slot inventory, required/optional slots, early/prime/late tiers, team blackout dates, round-robin draft generation, maximum weekly games, minimum rest, preferred weeknights, fairness heuristics, audited review/publish, manual fixture controls, and saved-data fairness/validation dashboards for team load, opponent matrix, time tiers, arenas, weekly loads, required inventory, blackout dates, conflicts, rest, and round-robin completeness. Generated games remain commissioner-only drafts until reviewed and explicitly published. Commissioners can explicitly replace unpublished generated drafts; old drafts are cancelled and audited, while published games and manual fixtures are protected. Commissioners can record rink/date-specific ice purchases, link/unlink inventory slots with an audit reason, cancel unassigned contracts, and review purchased, allocated, scheduled, draft, unallocated, overallocated, and unused hours with CAD/USD proportional cost estimates. The user reports applying migrations `202611120001_schedule_inventory_generator.sql` and `202611140001_ice_contracts_utilization.sql`; the latest read-only checker found all expected tables. Authenticated commissioner workflows still need testing.

- Final results and standings: assigned timekeepers submit scores computed from the event log; a different assigned referee or commissioner must approve before the result counts. Approved-only standings include configured points, ordered season tiebreakers, goals, overtime losses, and penalty minutes. Reopening or returning a result removes it from standings until correction and independent reapproval. The user reports migration `202611130001_game_results_standings.sql` has been applied; the latest schema check verifies expected tables, while authenticated workflows remain unverified.

- Commissioner roster management at /teams/[entryId]: create unclaimed player profiles, select existing league players, add/edit jersey numbers and positions, and deactivate/reactivate entries with retained history. Active roster limits, unique active jerseys, stale edits, and league isolation are checked by database functions. This is not player registration or game-eligibility approval. Captain access/identity claiming remain pending.

- Assigned-official scorekeeping at /schedule/[gameId]/scorekeeping: timekeepers and commissioners can record provisional goals and penalties against active game rosters; season settings bound periods and clock readings. Scoring events are retry-safe. Referees and commissioners can void incorrect entries with a required reason while retaining the original record. The same page supports submission, independent result approval, and reasoned correction. Every scheduled fixture has a league-member Live score page that polls saved events every three seconds, including event recovery after reconnect and voided-event exclusion. Apply local-only migration `202611150001_live_scoreboard.sql` before using the live page. Offline entry and push-based low-latency broadcasts remain incomplete.
- Player eligibility: an active roster member also needs approved season registration and acceptance of all current required documents. Commissioners can grant/revoke reasoned overrides; event writes enforce eligibility in the database. The local implementation is not usable against the currently connected hosted schema until the scoring and eligibility migrations are applied.
- Existing commissioners can create a separate league from My account after applying `202611110001_league_provisioning.sql`. The new league is selected immediately; existing league records are untouched. This lets the demo tenant remain isolated until a replacement is ready.

- Season settings at /league/settings: roster limits, registration dates, periods/clock mode, standings points and ordered tiebreakers, billing models, CAD/USD fees, commissioner write access, audit history, and revision conflict protection. Apply the settings and tiebreaker migrations before using the settings form.

- Sign-in/signup forms, email-confirmation callback, local sign-out, and cookie refresh proxy.
- Commissioner-managed season PDF waiver/code-of-conduct versions in private Supabase Storage; player applications require the current waiver and record typed-name acceptance with the file hash and version.
- Separate public-profile, filming, and marketing consent records, all defaulting to No. Consent withdrawal and downstream preference enforcement remain incomplete.
- Verified user and league membership checks before league reads and mutations.
- League selection for accounts with multiple memberships.
- Commissioner-only season/division creation and atomic team-plus-entry creation through Supabase.
- Dashboard and directory read Supabase; roles without commissioner access do not see creation forms.
- Password recovery, privileged-account MFA, invitations, richer roles, and production payments remain incomplete.
- PWA/offline scoring, push-based live broadcasts, schedule notifications, and public fan access outside authenticated league members remain incomplete.

## Verification

Scheduling checks (2026-10-28): nine tests pass; typecheck/build pass; anonymous /schedule returns HTTP 307 to /login. Time-zone tests cover Canadian winter/summer offsets, nonexistent times, and repeated DST times. Database tests cover overlap prevention, adjacent slots, draft privacy, cancellation/reinstatement conflicts, stale writes, audit history, and league isolation. Hosted/browser verification remains pending. Repeated DST local times currently require choosing a different start time; there is no first/second occurrence selector yet.

2026-10-28: all seven tests passed, covering roster limits, identical-name separation, private access, jersey conflicts, history, stale edits, and limits below occupancy. Typecheck/build passed. An unauthenticated roster request returned HTTP 307 to /login without exposing the form. Hosted/browser checks remain pending; Data API configuration still returns HTTP 401.

2026-11-09: the document/consent migration was confirmed by the user as applied to hosted Supabase. A read-only probe now reports Auth HTTP 200 and 23/26 expected private tables; scoring and eligibility remain missing. Local eligibility and hosted-workflow verification are in progress.

2026-11-04: assigned-official provisional scoring and audit-preserving corrections added in `202611040002_game_events.sql`. The hosted project was previously verified through 20 tables; this latest migration is not deployed. Local UI checks and hosted authenticated workflows remain pending.

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run supabase:check
```

The new scheduler has local PGlite coverage for inventory, tenant/commissioner guards, blackout and required-slot validation, round-robin generation, draft review, publishing, and audit history. Hosted migration and real-account workflow checks remain pending.

Still required: hosted migration verification, real signup/login/confirmation/session-refresh/sign-out testing, successful remote create/read checks, browser layout/form checks, and two-user/two-league hosted authorization tests.

## Existing local records

Preserved under .data/exports/2026-10-25T18-35-13.046Z/ as JSON and import-to-supabase.sql. The original .data/plaionn database is retained. Both are ignored by Git.

The export command is for recovery only and must run with all PGlite users stopped:

```powershell
npm.cmd run db:export-local
```

Do not remove the preserved data until the hosted import is verified.

## References

- [Project plan](../PROJECT_PLAN.md)
- [Delivery checklist](../TODO.md)
- [Client inputs](../CLIENT_INPUTS.md)
- [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)


## Officials assignments (2026-10-31)

Schedule ? Officials lets commissioners assign, replace, or remove the game crew with a reason and audit history. Existing referee/timekeeper league accounts are selectable. Conflict checks cover assignments and schedule changes, including the same official's bookings in other leagues. Apply migration `202610310001_official_assignments.sql` after the scheduling migration. Local validation and database tests pass (11 total), along with typecheck. Hosted/browser execution is not yet verified. Invitations, role onboarding, and scoring/approval permissions are separate tasks.

Verification 2026-10-31: all 11 tests, typecheck, and production build passed. Lint passed with one pre-existing unused-variable warning in season-settings.test.mjs. The unauthenticated officials request uses a streamed login redirect (HTTP 200 transport); no assignment form is exposed. Dev app is running at http://127.0.0.1:3000.

## Registration (2026-10-31)

New players use Registration in the main navigation. Commissioners use League HQ > Manage registration to publish configured season windows and review applications. Membership is granted only on approval; team placement, fees, waivers, and eligibility are separate. Apply `202610310002_registration.sql` after previous migrations. All 13 tests, typecheck, and build pass; lint has one existing unused-variable warning. Hosted and authenticated browser checks are pending. See the Supabase README for behavior and limitations.
