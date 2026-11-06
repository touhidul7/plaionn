# Current deployment review - 2026-11-06

Client preview setup: [Vercel deployment guide](../VERCEL_DEPLOYMENT.md), [client walkthrough](../CLIENT_TEST_GUIDE.md), [review findings](../APP_REVIEW_2026-11-06.md).

All 18 local tests, production build/TypeScript and lint pass. Supabase Auth responds successfully; 20/22 private tables exist, with scoring tables missing. Apply the missing migrations and configure the deployment/accounts before client use. Historical verification entries below describe their stated dates, not current release readiness.

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

Current verification (2026-11-04): the public key and all 20 tables deployed before the scoring slice were verified. The new game-events migration has not been applied to hosted Supabase; the updated connection checker expects 22 tables and will report those two missing tables until deployment.

The app no longer reads or writes local PGlite data. It uses authenticated Supabase queries and RLS, and does not fall back to local storage on a failed request. The original local database remains untouched for recovery.

## Current functionality

- Scheduling at /schedule: commissioner venue/rink setup, venue-local time entry, draft/scheduled/cancelled fixtures, same-division matchups, overlap checks, audited rescheduling/cancellation, and stale revision protection. Drafts reserve teams/rinks but are hidden from ordinary league members; scheduled and cancelled fixtures are visible to members. Conflicts are scoped to a league, not a shared physical arena across tenants.

- Commissioner roster management at /teams/[entryId]: create unclaimed player profiles, select existing league players, add/edit jersey numbers and positions, and deactivate/reactivate entries with retained history. Active roster limits, unique active jerseys, stale edits, and league isolation are checked by database functions. This is not player registration or game-eligibility approval. Captain access/identity claiming remain pending.

- Assigned-official scorekeeping at /schedule/[gameId]/scorekeeping: timekeepers and commissioners can record provisional goals and penalties against active game rosters; season settings bound periods and clock readings. Scoring events are retry-safe. Referees and commissioners can void incorrect entries with a required reason while retaining the original record. This does not finalize game results, provide offline entry, broadcast live updates, or calculate standings.

- Season settings at /league/settings: roster limits, registration dates, periods/clock mode, standings points and ordered tiebreakers, billing models, CAD/USD fees, commissioner write access, audit history, and revision conflict protection. Apply the second migration and `202611040001_standings_tiebreakers.sql` before using the new setting. Roster enforcement, standings calculation, and invoicing remain separate upcoming features.

- Sign-in/signup forms, email-confirmation callback, local sign-out, and cookie refresh proxy.
- Verified user and league membership checks before league reads and mutations.
- League selection for accounts with multiple memberships.
- Commissioner-only season/division creation and atomic team-plus-entry creation through Supabase.
- Dashboard and directory read Supabase; roles without commissioner access do not see creation forms.
- Password recovery, privileged-account MFA, invitations, richer roles, payments, final-result approval, and official standings remain incomplete.
- PWA/offline scoring, live score broadcasts, purchased ice inventory, schedule notifications, and public fan schedule access remain incomplete.

## Verification

Scheduling checks (2026-10-28): nine tests pass; typecheck/build pass; anonymous /schedule returns HTTP 307 to /login. Time-zone tests cover Canadian winter/summer offsets, nonexistent times, and repeated DST times. Database tests cover overlap prevention, adjacent slots, draft privacy, cancellation/reinstatement conflicts, stale writes, audit history, and league isolation. Hosted/browser verification remains pending. Repeated DST local times currently require choosing a different start time; there is no first/second occurrence selector yet.

2026-10-28: all seven tests passed, covering roster limits, identical-name separation, private access, jersey conflicts, history, stale edits, and limits below occupancy. Typecheck/build passed. An unauthenticated roster request returned HTTP 307 to /login without exposing the form. Hosted/browser checks remain pending; Data API configuration still returns HTTP 401.

2026-11-04: standings tiebreaker and provisional scoring migration tests pass; the full serial test suite, typecheck, and production build pass. Hosted migration/browser checks remain pending.

2026-11-04: assigned-official provisional scoring and audit-preserving corrections added in `202611040002_game_events.sql`. The hosted project was previously verified through 20 tables; this latest migration is not deployed. Local UI checks and hosted authenticated workflows remain pending.

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run supabase:check
```

The 16-test local suite, type checking, and production compilation pass. Lint reports one pre-existing unused-variable warning in `tests/season-settings.test.mjs`. HTTP checks verified the login page and sign-in redirects without exposing team data. The export import dry run restored one season, one division, one team, and one entry.

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
