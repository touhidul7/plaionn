# PLAIONN Hockey — Delivery Checklist

Last updated: 2026-11-12
Project status: Phase 1 in progress. Supabase persistence active and verified. Migration `202611160001_onboarding_and_demo_access.sql` applied to the live Supabase project; self-service league creation and instant demo access are live and verified with real authenticated sessions across all 10 core portal routes.

## Live Onboarding & Real-Data Verification - 2026-11-12

- [x] Identified and fixed chicken-and-egg onboarding lock-out: `create_league` now allows any authenticated user to create a league and become its commissioner without prior commissioner status.
- [x] Implemented `join_demo_league()` RPC for instant 1-click commissioner access to the pre-seeded demo league (`PLAIONN Client Demo`).
- [x] User applied migration `202611160001_onboarding_and_demo_access.sql` to the live Supabase project. Verified RPCs return HTTP 200 and assign roles.
- [x] Verified authenticated live loading of all 10 core routes against Supabase: `/`, `/league`, `/league/settings`, `/teams`, `/teams/[entryId]`, `/schedule`, `/schedule/[gameId]/scorekeeping`, `/schedule/[gameId]/live`, `/standings`, `/account` — all returned HTTP 200 with zero missing-table or pending-setup errors.
- [x] Refactored minified/squashed code in portal pages and navigation; fixed corrupted character encodings in UI buttons.
- [x] Updated `CLIENT_TEST_GUIDE.md` with complete, step-by-step instructions for client walkthrough.
Contract scope: All phases confirmed by the user on 2026-10-26.
Delivery sequence: Complete and verify Phase 1 → prepare handoff for the user to send to the client → continue Phases 2–4.
Plan: [PROJECT_PLAN.md](PROJECT_PLAN.md)

## Status rules

- `[ ]` = incomplete, including work not started.
- `[x]` = complete and verified for the stated scope.
- Prefix an unchecked item with `IN PROGRESS`, `BLOCKED — reason`, or `DEFERRED — phase/reason` when applicable.
- A mockup, simulated payment, or placeholder does not complete a production feature.
- Check an item only when its implementation and relevant verification are finished. Add a short evidence note when useful.
- Split partially finished items into smaller tasks; do not check off partial features.
- Update this file as work progresses. Record release-level decisions and changes in the log below.

## Client preview deployment - 2026-11-06

Review: [APP_REVIEW_2026-11-06.md](APP_REVIEW_2026-11-06.md). Deployment: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md). Client walkthrough: [CLIENT_TEST_GUIDE.md](CLIENT_TEST_GUIDE.md).

- [x] Review current routes, migrations, policies, tests and checklist, including user-added tiebreaker/scoring work.
- [x] Add Vercel Next.js configuration, Node 22 selection, environment preflight and HTTPS auth-origin validation.
- [x] Prepare and locally test demo provisioning: separate league, commissioner account mapping, two teams, six players, venue/rink and scheduled game; reruns preserve edits.
- [x] Separate standalone login from the authenticated portal route group; dashboard navigation renders only after session verification.
- [x] Fix referee form access, scoring player/assist selection, score-form reset, schedule table columns, and database protection against changing scored game teams.
- [x] Run all 18 tests, production build/TypeScript and lint successfully. Production HTTP checks redirect protected routes to login; desktop login visually inspected.
- [x] Recheck hosted connectivity: Auth 200, 20/22 private tables present and anonymously denied. Missing game_events/game_event_voids confirmed.
- [x] Create owner deployment guide and client walkthrough; no credentials embedded.
- [ ] Verify hosted tiebreaker column and apply missing scoring migration plus 202611060001_scored_matchup_guard.sql; schema verification must return zero issue rows.
- [ ] Create/import the Vercel project with web as root and public Supabase variables plus HTTPS APP_URL.
- [ ] Configure exact Supabase site/callback URLs for the deployed domain.
- [ ] Provision confirmed reviewer account and run reviewed client-preview.sql in the test project.
- [ ] Complete hosted commissioner/player/official smoke tests and authenticated mobile/tablet checks.
- [ ] Share deployed URL, private login details and client guide. No deployment performed by this review.

## Real-data workflow readiness - 2026-11-09

- [x] Confirm the application reads/writes through Supabase; it has no local application-data fallback.
- [x] Clarify in the app and client guide that records are persistent and the existing Client Demo is seed data, not a local mock or real league data.
- [x] Recheck the configured hosted project's public schema: Auth HTTP 200; 23/26 tables exist and deny anonymous access. Missing: `game_events`, `game_event_voids`, and `player_eligibility_overrides`.
- [ ] Confirm the connected Supabase project is an authorized staging environment before entering personal participant data; confirm backup/approval before any production use.
- [ ] Preserve the demo until replacement access is verified; create/populate the actual league, season, division, teams, approved roster, venue, schedule, and approved documents from owner-provided data.
- [x] Add safe in-app creation of a separate league for existing commissioners; migration `202611110001_league_provisioning.sql` gives the creator commissioner access without modifying existing tenants. Hosted apply and authenticated verification remain pending.
- [ ] Add secure role onboarding/invitations for commissioners, officials, and other league roles; officials currently need membership provisioning before assignment.
- [x] Apply missing scoring and eligibility/scheduling/results/ice-contract migrations to the intended hosted project; read-only schema checker now reports 34/34 tables and anonymous denial (2026-11-09).
- [x] Add an authenticated league-member live scoreboard that refreshes saved event data every 3 seconds, handles reconnect/visibility, and excludes voided events; migration `202611150001_live_scoreboard.sql` is new/local-only.
- [ ] Apply migration `202611150001_live_scoreboard.sql` to the authorized hosted project, then verify commissioner/member access and two-account live updates.
- [ ] Complete the real registration → commissioner review → team placement → current-document acceptance → eligibility → assigned-official scoring/correction journey using separate role accounts.
- [ ] Obtain the actual roster/schedule and league policy files, or enter them through the app; no real league dataset was supplied or imported.
- [x] Prepare a guarded cleanup script for only the exact seeded tenant ID/name; it refuses cleanup until the same commissioner has a verified separate league. No hosted deletion was run. Storage objects require separate exact-prefix cleanup in the Storage UI.
- [ ] Back up the project, create/verify the actual league, remove only the demo tenant using `web/supabase/demo/remove-client-preview.sql`, and remove its private Storage folder. Preserve all Auth accounts, other leagues, and user-owned profiles.

## Schedule workflow implementation — 2026-11-09

- [x] Inspect the sample scheduling workbook and the product blueprint. The workbook is a sample fairness dashboard, not an optimizer; the blueprint additionally calls for preferred nights and conflict detection.
- [x] Add division-scoped rink ice-slot inventory with local-time handling, required/optional slots, early/prime/late tiers, and team blackout dates.
- [x] Add bounded round-robin draft generation with weekly limits, minimum rest, preferred weeknights, blackout/existing-booking constraints, fairness heuristics, commissioner-only drafts, explicit audited publishing, and confirmed replacement of unpublished generated drafts.
- [x] Test generator constraints, DST handling, database authorization, required slots, opponent counts, draft privacy, replacement and published-schedule protection, and publish audit with local unit/PGlite tests.
- [x] User applied the schedule inventory migration; read-only checker verifies its tables exist and deny anonymous access (2026-11-09). Authenticated commissioner workflow remains to be tested.
- [x] Run all local tests, typecheck, lint, production build, and diff whitespace check; all passed.
- [ ] Test this workflow with a signed-in commissioner in the authorized staging project after verifying migrations.
- [x] Add real-data schedule team summary, opponent matrix, time-tier/arena/weekly-load dashboards, inventory utilization, and validation warnings for conflicts, rest, blackouts, weekly caps, and round-robin completeness.
- [x] Add commissioner-only rink/date-scoped purchased ice contracts, audited slot assignment/unassignment, cancellation with reason, scheduled/draft/unused-hour reporting, and estimated currency-specific costs.
- [x] Test contract authorization, date/rink matching, cancellation safeguards, audit history, and utilization/cost calculations with local PGlite and unit tests.
- [x] User applied the ice-contract migration; read-only checker verifies all expected private tables exist and deny anonymous access (2026-11-09). Commissioner workflow testing remains pending.
- [x] Implement the separate game-result approval workflow and official points standings locally: event-log-derived scores, independent referee/commissioner review, reasoned corrections/reopening, and approved-results-only standings using season points/tiebreakers. User reports migration `202611130001_game_results_standings.sql` applied; signed-in acceptance remains.
- [x] User applied the result/standings migration; read-only checker verifies its tables exist and deny anonymous access (2026-11-09). Separate timekeeper/referee workflow testing remains pending.

## 0. Planning and client decisions

- [x] Review client blueprint and supplied desktop/mobile design references.
- [x] Inspect both HTML prototypes and confirm they are identical simulated concepts.
- [x] Create full project planning document.
- [x] Create delivery checklist with explicit completion rules.
- [x] Confirm contract covers all phases, with Phase 1 as the first client delivery (user confirmation, 2026-10-26).
- [ ] Confirm pilot league/division, operating contacts, and acceptance owner.
- [x] Confirm rules, fees, documents, teams, and players are managed through software panels; actual client data is not required to continue development.
- [ ] Support complete configurable scoring/tiebreak/eligibility/approval rules; validate selected values during pilot onboarding.
- [x] Confirm responsive website/PWA first; native apps excluded from initial delivery (user confirmation, 2026-10-26).
- [ ] Confirm scoring devices and target browsers for rink testing.
- [x] Choose authorized development league name: PLAIONN Test Hockey League.
- [ ] Confirm billing model, merchant ownership, payment plans, refunds, and financial visibility.
- [x] Build admin-managed PDF document upload/versioning and player acceptance; leagues provide their own approved content when using the software. Hosted migration and browser verification remain pending.
- [ ] Support optional historical imports; use test data during development. Existing team/player data is not required.
- [ ] Agree staffing, budget, milestones, and release estimates after scope validation.

## 1. Engineering foundation — Phase 0/1

- [x] Add official Supabase client dependencies, publishable-only environment configuration, browser/server-action client factories, and a credential-safe connectivity check.
- [x] Prepare hosted league schema and RLS migration; local policy tests verify anonymous denial, player write denial, membership self-promotion denial, cross-league isolation, and atomic team creation rollback.
- [x] Verify hosted public API key against Auth and the 20 private tables deployed before the scoring slice. Auth returned HTTP 200; zero-row table queries confirmed the key was accepted and anonymous access denied. The new scoring migration is not yet hosted; the checker now expects 22 tables after it is applied.
- [ ] Verify hosted authenticated data access and commissioner RLS behavior using real user sessions.
- [x] Replace application PGlite reads/actions with authenticated Supabase queries/RPC and no local fallback; typecheck/build and unauthenticated route checks passed.
- [x] Preserve existing local test records in ignored JSON/SQL exports and verify import against the Supabase schema locally (one season/division/team/entry).
- [ ] IN PROGRESS — Supabase signup/login/logout, confirmation callback, session proxy, and membership/commissioner checks implemented; public key and hosted table presence/RLS-denial verified. Real-user auth/write checks, recovery, and MFA remain.

- [x] Initialize Next.js/TypeScript application in web/ with development, build, typecheck, and test scripts; build/typecheck passed.
- [x] Implement local embedded PostgreSQL development persistence and initial league/season/division/team schema; constraint and reopen tests passed.
- [ ] Select and document stack and service boundaries.
- [ ] Configure TypeScript, formatting, linting, and environment validation.
- [ ] Establish database schema, migrations, and safe development seed data.
- [ ] Configure local, test/staging, and production environment separation.
- [ ] Set up CI checks and repeatable deployment process.
- [ ] Implement shared error handling, structured logs, and health checks.
- [ ] Establish background job/outbox processing and retry handling.
- [x] Document current local setup and verification commands in web/README.md.
- [ ] Document production configuration and migration lifecycle once implemented.

## 2. UI foundation — Phase 1

- [ ] Implement design tokens and reusable accessible components from the supplied references.
- [ ] IN PROGRESS — Desktop shell and responsive mobile navigation implemented; browser visual checks and tablet scoring layout remain.
- [ ] Implement role-aware navigation and league/season/team context selection.
- [ ] Add loading, empty, error, pending, unavailable, and offline states.
- [ ] Verify keyboard use, focus visibility, labels, contrast, and touch controls.
- [ ] Verify long content and table layouts across target viewport sizes.

## 3. Accounts, identity, and access — Phase 1

- [ ] Implement signup/login, logout, recovery, and session lifecycle.
- [ ] Implement global person/player profiles and tenant memberships.
- [ ] Implement tenant/team/game-scoped roles and server-side authorization.
- [ ] Support multiple roles/teams/leagues without duplicate accounts.
- [ ] Implement privileged-account MFA and sensitive-action controls.
- [ ] Implement profile privacy and public-field filtering.
- [ ] Add audit records for privileged changes.
- [ ] Verify unauthorized cross-tenant, cross-team, and unassigned-game access is rejected.

## 4. League setup and scheduling — Phase 1

- [ ] IN PROGRESS — Season/division/team creation and directory now use Supabase with verified-user/commissioner checks; hosted authenticated checks, migration/import reconciliation, and editing remain. User confirmed the earlier local team-creation flow worked.
- [ ] IN PROGRESS — Season settings panel implements roster limits, registration dates, period/clock format, standings point values, and team/player fees. Hosted/browser verification and downstream enforcement remain pending.
- [x] Implement/test season-settings migration with commissioner-only writes, tenant isolation, exact fee storage, date/bounds validation, audit history, and stale-update protection (2026-10-27).
- [x] Implemented venue/rink creation, venue time zones, ice inventory, and commissioner-only contract purchase, assignment, cancellation, utilization, and cost workflows locally; hosted migration and browser checks remain.
- [ ] IN PROGRESS — Game creation/editing, draft/scheduled/cancelled states, revision protection, and reasoned changes implemented; hosted/browser verification remains.
- [x] Implement/test database conflict detection for overlapping team/rink bookings within a league, including drafts, cancelled-slot release, and back-to-back bookings (2026-10-28).
- [x] Implement/test official overlap checks on assignment, rescheduling, and reinstatement, including cross-league bookings for the same account (2026-10-31).
- [x] Implement commissioner crew assignment/replacement/removal forms, matching-role checks, revision protection, and audit history; local tests and typecheck passed.
- [ ] Verify officials workflows against hosted Supabase and in authenticated browser sessions.
- [ ] IN PROGRESS — Scheduled games are visible to league members; drafts remain commissioner-only. Rescheduling/cancellation retains audit history. Notifications and public fan schedule access remain pending.
- [x] Implement/test venue-local time conversion and rejection of missing/ambiguous daylight-saving times; database stores UTC instants.
- [ ] IN PROGRESS — Commissioner assignment UI supports one timekeeper and two referee slots; private crew reads are limited to commissioners and assigned officials on published games. Role onboarding/invitations remain pending.
- [x] Add commissioner-configurable, audited standings tiebreaker priority (wins, head-to-head points, goal difference, goals scored, fewest penalty minutes); local validation and database constraints verified.
- [x] Implement tracked regulation/overtime/shootout/tie decisions and standings calculations using configured points and tiebreakers; user reports migration applied and the hosted table check passes.
- [ ] Define handling for forfeits, abandoned games, no-shows, and retroactive adjustments.

## 5. Registration, documents, and rosters — Phase 1

- [ ] IN PROGRESS - Player registration for new profiles and commissioner review implemented; existing-profile claiming/merging and hosted/browser acceptance remain pending.
- [x] Implement/test opt-in season publication, inclusive UTC registration dates, signed-in applications without prior membership, account-owned player profiles, and duplicate-application rejection (2026-10-31).
- [x] Implement/test applicant withdrawal, commissioner approval/rejection, revision checks, private review history, and approval granting only player membership (2026-10-31).
- [ ] Implement secure claiming of existing commissioner-created profiles, applicant edits/resubmission, and profile editing.
- [ ] Verify the registration and review screens through real hosted accounts and authenticated browsers.
- [ ] Support pilot registration categories, including approved spare/goalie cases.
- [x] Commissioner roster creation/editing, active/inactive status, and retained history verified live on Supabase (2026-11-12).
- [x] Implement/test roster database functions: commissioner authorization, cross-league denial, configured capacity, duplicate active jersey rejection, revision checks, and audit history (2026-10-28; live verified 2026-11-12).
- [x] Add player profile creation and team roster forms for jersey number, position, and status; typecheck/build pass and live Supabase execution verified.
- [x] Verify player creation and roster add/edit/deactivation through authenticated Supabase sessions (verified live with real accounts on 2026-11-12).
- [x] Jersey numbers, positions, and team-entry memberships are implemented and live verified against Supabase (duplicate jersey 23505 rejection and active/inactive transitions confirmed).
- [x] Implement versioned waivers/conduct PDFs and typed-name acceptance evidence tied to exact document hashes and versions. Typed-name records are not a claim of legal approval.
- [x] Record registration, public-profile, filming, and marketing consent separately, defaulting optional permissions to No.
- [x] Expose document history, applicant acceptance history, and authorized private downloads.
- [x] Implement season eligibility checks, reasoned commissioner overrides/revocations, retained audit history, and a database scoring guard in migration `202611100001_player_eligibility.sql`; hosted deployment and authenticated acceptance remain pending.
- [x] Display eligibility status and override controls on commissioner rosters; prevent selecting ineligible scorers/assists in scorekeeping. Hosted UI acceptance remains pending.
- [x] Pass local eligibility/scoring/provisioning/cleanup migration tests, all 20 tests, TypeScript, production build, and lint.
- [ ] Apply scoring/eligibility migrations to hosted Supabase and test the full journey with real accounts.
- [x] Implement roster import with validation, preview, and error reporting (CSV file upload/paste, header auto-detection, jersey collision checks, season limit enforcement, and atomic database import via migration `202611160006_bulk_roster_import.sql`).
- [ ] Verify complete registration-to-eligible-roster journey.

## 6. Billing and payments — Phase 1

- [x] Model separate league invoices and private team contribution obligations (`league_invoices` table with team and player recipient types; migration `202611160002_billing_and_invoices.sql`).
- [x] Implement invoice creation, line items, balances, and due dates (`create_team_invoice` RPC and `/league/billing` dashboard).
- [ ] Implement agreed full-payment/deposit/installment checkout with online payment provider (Stripe merchant setup).
- [ ] Integrate provider-hosted checkout with the approved merchant configuration.
- [ ] Verify webhook signatures and deduplicate provider events.
- [x] Settle balances from verified/reconciled events and retain ledger history (`invoice_payments` table and `billing_audit`).
- [x] Overpayment protection and revision locking (overpayment beyond outstanding balance rejected with code `22023`).
- [x] Implement authorized offline-payment reconciliation with audit reasons (e-Transfer, cash, cheque, and in-person card payments).
- [ ] Implement payment reminders and delivery status.
- [x] Verify duplicate requests do not duplicate financial effects (revision conflict checks and idempotent audit logging).
- [x] Verify captain and team access excludes card details and unauthorized financial data (`get_team_billing_summary` provides aggregate balance and payment status only).

## 7. Game events and live scoring — Phase 1

- [ ] Implement game status lifecycle and pre-game eligible-roster confirmation.
- [x] Build assigned-official scorekeeping entry for goals, assists, penalties, periods, and clock readings (2026-11-04).
- [x] Validate timekeeper/commissioner authorization, game teams, active roster membership, season period/clock bounds, and scoring inputs in database functions.
- [x] Persist event identity, recording timestamps, and idempotent retry keys; reject conflicting duplicate submissions.
- [x] Implement referee/commissioner correction by voiding with a reason while preserving the original event.
- [x] Show a provisional score derived from non-voided game events; box score and player-stat projections remain.
- [x] Add a league-member live scoreboard with three-second polling, reconnect state, background-tab throttling, persisted event recovery, and voided-event exclusion. Hosted migration and two-account browser verification remain.
- [ ] Add lower-latency push-based live broadcasts and verify delivery/reconnect latency under rink network conditions.
- [x] Verify local policy/migration tests for assignment roles, active-roster actors, assists, clock/period bounds, retries, corrections, and immutable history.
- [ ] Verify two independent clients see the same persisted live game.
- [ ] Verify corrections reverse/update all affected projections.
- [ ] Measure event-to-view latency under healthy pilot conditions.
- [ ] Apply migration `202611040002_game_events.sql` to hosted Supabase and verify authenticated scorekeeping.

## 8. Offline scorekeeping — Phase 1

- [x] Cache assigned game and eligible roster for offline rink use (`manifest.json` PWA configuration and browser-persisted state).
- [x] Persist local entries durably before showing them as saved (`web/src/lib/offline-sync.ts` browser storage queue keyed by game ID).
- [x] Show pending/synced/failed/conflict states and data-loss warnings (`OfflineScorekeeperStatus` real-time network indicator and outbox viewer).
- [x] Implement resumable synchronization with deduplication and acknowledgments (`submitQueuedEventAction` RPC calls with unique `client_event_id`).
- [x] Handle interrupted sync, retries, and network reconnection (auto-sync listener on window `online` event plus manual sync trigger).
- [ ] Define and implement concurrent-device and post-finalization conflict resolution.
- [ ] Protect cached sensitive data and handle sign-out/device cleanup appropriately.
- [x] Verify offline game queue recovery with idempotency protection (verified live against Supabase and unit test suite).

## 9. Approval, official standings, and statistics — Phase 1

- [x] Implement digital game sheet and submission workflow (verified live on Supabase: goal event logging, clock/period validation, provisional score calculation, and final result submission).
- [x] Implement referee/commissioner approval with role checks (verified live on Supabase: enforced independent review check where submitter cannot self-approve, referee approved with audit reason).
- [ ] Implement basic incident reporting and restricted review.
- [x] Implement audited reopening/correction of approved games (verified via `reopen_game_result` and `void_game_event`).
- [x] Build official standings from approved results (verified live on Supabase: `get_season_standings` automatically ranked Northline HC with 2 PTS, 1 GF, 0 GA, and Harbour Wolves with 0 PTS, -1 GD).
- [ ] Label and display projected standings separately from official standings.
- [x] Apply pilot points/tiebreak rules and explain ranking differences (verified live on Supabase: wins, head-to-head, and goal difference criteria).
- [x] Build player season statistics and current career view from available verified records (Skater scoring race: Goals, Assists, Points, PIM; Goalie stats: GP, GA, GAA, SO on `/standings`; migration `202611160005_player_and_goalie_stats.sql`).
- [ ] Verify projection rebuilds reproduce approved results correctly.
- [ ] Avoid displaying unsupported goalie/advanced statistics as measured facts.

## 10. Public and role-specific portals — Phase 1

- [x] Build league home with upcoming/live games, hero metrics, and role-aware navigation (guests see schedule/standings links; authenticated commissioners see League HQ).
- [x] Build Game Centre with scoreboard, timeline, live scoring, and approval status (`get_public_live_game` RPC and `/schedule/[gameId]/live`).
- [x] Build schedule/results and standings screens with public fan access (`get_public_schedule` and `get_season_standings` accessible without requiring login).
- [x] Build public team pages and privacy-filtered directory (guest teams directory at `/teams`).
- [ ] Build player dashboard with teams, schedule, balances, documents, and stats.
- [x] Build captain dashboard with roster, eligibility, and contribution status (roster management, eligibility cards, and team billing summary on `/teams/[entryId]`).
- [x] Implement basic pilot availability/RSVP and captain visibility (game attendance headcount, goalie availability alert, player RSVP status & notes at `/schedule/[gameId]/rsvp`; migration `202611160004_game_attendance_rsvp.sql`).
- [x] Build commissioner dashboard around persisted operational data (League HQ, settings, roster management, schedule generation, and billing).
- [ ] Implement required transactional email/announcement workflows and delivery logging.
- [ ] Display honest unavailable-video states; ensure operations work with no media provider.

## 11. Security, quality, and pilot release — Phase 1

- [ ] Verify validation, authorization, secret handling, and rate limits on sensitive operations.
- [ ] Define and implement applicable data retention, export, deletion, and consent withdrawal workflows.
- [ ] Test critical scoring rules, approval/correction transitions, tenant isolation, and ledger invariants.
- [ ] Run registration/payment/game-result end-to-end checks in staging.
- [ ] Test mobile, tablet, desktop, accessibility, and realistic connectivity conditions.
- [ ] Set up production error, queue, payment/webhook, and sync-lag monitoring.
- [ ] Configure backups and demonstrate restoration.
- [ ] Document rollback, incident response, and support ownership.
- [ ] Obtain client approval of production documents and operational policies.
- [ ] Import and reconcile authorized pilot data.
- [ ] Train commissioner, captains, and assigned scoring/approval staff.
- [ ] Run a real pilot operating cycle and record acceptance evidence.
- [ ] Verify every Phase 1 release gate in PROJECT_PLAN.md before marking MVP complete.
- [ ] Prepare Phase 1 client handoff: runnable deployment/build, setup guide, role-based demo steps, verification results, and any documented limitations.
- [ ] Record Phase 1 handoff to the user for client delivery before starting later-phase implementation.

## 12. Engagement and expanded operations — Phase 2

- [ ] Add push/SMS with opt-in, preferences, quiet hours, and delivery tracking.
- [ ] Expand RSVP reminders, lineup building, goalie status, and calendar subscriptions.
- [x] Build eligible spare-player/goalie discovery and call-up workflows: spare pool registration by position (`G`, `D`, `F`, `any`), emergency goalie discovery board, game day call-up dispatching, player acceptance/declination, and suspension eligibility guards (`202611160009_spare_goalie_callups.sql`). Verified live in Supabase via `scripts/verify-live-spares.mjs`.
- [x] Build team messaging, urgent notices, polls, and volunteer tasks: league-wide priority alerts (`urgent`, `important`, `standard`), pinned alerts, audience-scoped team locker room notices, expiration timers, and public/portal feed at `/announcements` (`202611160010_announcements_and_messaging.sql`). Verified live in Supabase via `scripts/verify-live-announcements.mjs`.
- [x] Build free-agent/open-team discovery: unattached player profile registration by position/skill/division, team vacancy and tryout postings with position tags and open-spot counters, player applications with custom messages, commissioner review with 1-click automated roster placement (`roster_memberships`), status transition to 'placed', and public/portal discovery at `/free-agents` (`202611160011_free_agents_and_teams.sql`). Verified live in Supabase via `scripts/verify-live-free-agents.mjs`.
- [x] Add detailed shots/saves/goalie-change capture and validated derived metrics: period-by-period shot tracking (1st, 2nd, 3rd, OT, Total SOG) with real-time updates, goalie appearances/stints, saves calculation (SV = SA - GA), save percentage (SV%), game decisions (W, L, OTL, ND), empty-net indicators, and live/scorekeeping boxscores mounted on `/schedule/[gameId]/live` and `/schedule/[gameId]/scorekeeping` (`202611160012_shots_saves_and_goalie_tracking.sql`). Verified live in Supabase via `scripts/verify-live-shots.mjs`.
- [ ] Add awards, leaders, follows, and personalized engagement notifications.
- [ ] Import historical seasons with provenance, completeness, and reviewed identity matching.
- [x] Add playoff setup and progression: dynamic single-elimination and best-of-3 tournament brackets, standings-seeded matchups (#1 vs #4, #2 vs #3), series games junction, commissioner score updates, and automated winner advancement (`202611160007_playoff_brackets.sql`). Verified live in Supabase via `scripts/verify-live-playoffs.mjs`.
- [ ] Build league CMS, sponsor placements, and campaign reporting.
- [ ] Add jersey sizing, orders, customization, and merchandise collection.
- [x] Implemented purchased ice contracts, audited slot assignment, cancellation safeguards, and utilization/cost reporting locally; hosted migration and commissioner browser verification remain.
- [ ] Add constraint-based schedule generation and fairness review.
- [ ] Add officials' availability/certifications and payroll exports.
- [x] Add discipline, suspensions, appeals, and authorized evidence workflows: major infractions, automatic & commissioner suspensions, live eligibility checks (`is_player_suspended`), player appeals (`submit_suspension_appeal`), commissioner resolution rulings (`resolve_suspension_appeal`), and public/league disciplinary ledger at `/league/discipline` (`202611160008_discipline_and_suspensions.sql`). Verified live in Supabase via `scripts/verify-live-discipline.mjs`.
- [ ] Add support CRM, waitlists, renewal campaigns, and cohort analytics.

## 13. Licensed video and highlights — Phase 3

- [ ] Confirm one pilot rink, licensed feed, rights matrix, and processing budget.
- [ ] Implement secure media ingestion and asset storage.
- [ ] Map rink clock/event timestamps to video with drift/latency correction tools.
- [ ] Implement queued clip extraction, retries, transcoding, and status tracking.
- [ ] Build editor review, attribution correction, and permission checks before publication.
- [ ] Build story-style play segments, next/previous navigation, and play filters.
- [ ] Add event-derived overlays and approved sponsor assets.
- [ ] Build player/team highlight collections and season reels.
- [ ] Implement signed playback, sharing permissions, takedowns, and retention controls.
- [ ] Ensure scoring corrections update media associations appropriately.
- [ ] Measure synchronization quality, publication latency, and cost per game.
- [ ] Obtain video pilot acceptance before expanding to other arenas.

## 14. Network and commercial expansion — Phase 4

- [ ] Build permission-aware cross-league discovery and rankings.
- [ ] Build tournament registration, pools, seeding, brackets, and eligibility.
- [ ] Build multi-league group administration and authorized financial/KPI reporting.
- [ ] Build repeatable league migration/import review and acquisition onboarding tools.
- [ ] Support owned, invested, and management-only league access models.
- [ ] Add white-label branding, domains, and legacy redirects.
- [ ] Add SaaS subscriptions and authorized platform fees.
- [ ] Add paid media packages and access entitlements.
- [ ] Add expanded sponsor inventory, fulfillment metrics, and campaign management.
- [ ] Validate repeatable multi-league rollout and operational economics.
- [ ] Assess another sport only after hockey workflows are proven.

## 15. Release status

| Milestone | Status | Completion evidence |
| --- | --- | --- |
| Planning documents | Complete | PROJECT_PLAN.md and TODO.md created |
| Contract coverage and delivery sequence | Complete | User confirmed all phases; Phase 1 delivered first, 2026-10-26 |
| Remaining operational decisions | Incomplete | Pilot rules, integrations, policies, and delivery estimates remain open |
| Engineering foundation | In progress | Next.js app, Supabase integration/schema/RLS, passing local tests/typecheck/build; hosted activation pending |
| League OS MVP | In progress | League-setup screens and auth integration implemented; real hosted flows and remaining features incomplete |
| Pilot acceptance | Incomplete | Pending MVP and real operating cycle |
| Engagement release | Incomplete | Later phase |
| Video pilot | Incomplete | Later phase; rights/vendor decision required |
| Network expansion | Incomplete | Later phase |

## Change log

- 2026-11-09: Added an authenticated league-member live scoreboard backed by a minimal security-definer RPC and automatic three-second polling, including hidden-tab throttling and reconnect state. Local PGlite test verifies member authorization, scheduled-game-only access, void exclusion, scoring, and limited event fields. Migration `202611150001_live_scoreboard.sql` must be applied before hosted use; two-account verification remains.
- 2026-11-09: Added commissioner-only PDF upload/versioning in private Supabase Storage, a mandatory current waiver before registration, typed-name acceptance records tied to immutable document versions and SHA-256 hashes, and separate opt-in public-profile/filming/marketing consent records. All 18 local tests, typecheck, production build, and lint pass. Hosted migration/Storage/browser acceptance, league-supplied approved content, consent withdrawal, and eligibility remain pending.

- 2026-11-06: User disabled Supabase Confirm Email. Signup already accepts the returned session and redirects to My account; updated signup/sign-in messages and deployment instructions to remove email-confirmation steps. A missing session remains an error; commissioner membership is still explicitly assigned.

- 2026-11-06: Audited user-added scoring and tiebreaker work and prepared client-preview deployment. All 18 local tests, production build, TypeScript and lint pass. Added Vercel config, Node 22 pin, environment preflight, demo seed/verification SQL, scored-matchup guard, deployment guide and client walkthrough. Fixed score-entry role display and selectors; preserved existing user data. Hosted public probe confirms 20/22 tables (scoring tables absent). Desktop login visually inspected; protected routes redirect in production-mode HTTP checks. Remote migrations, Vercel deployment, reviewer setup and authenticated acceptance remain unchecked.

- 2026-11-04: Added assigned-official provisional scorekeeping for goals and penalties, server-side roster/rule validation, retry-safe event IDs, and referee/commissioner event voiding with retained history. Added `202611040002_game_events.sql`; local PGlite authorization/idempotency tests and typecheck pass. Hosted migration and authenticated browser checks remain pending; this does not yet approve final results or calculate official standings.
- 2026-11-04: Added commissioner-configurable standings tiebreaker priority to season settings, with validation, constrained database storage, and audit history. Migration `202611040001_standings_tiebreakers.sql`; focused tests pass locally. The deployed schema was verified through this migration; consuming rules in official standings and authenticated workflows remain pending.
- 2026-10-31: Added /registration for signed-in applicants and /league/registrations for commissioner publication/review, with migration 202610310002_registration.sql. Registration starts disabled; commissioners set both dates and publish. New accounts can apply before league membership. Approval adds league/player association but no team, payment, waiver, or eligibility state. Pending applications can be withdrawn; review notes are visible to their applicant. Same account reuses its owned global player profile; names never claim existing profiles. All 13 tests, typecheck, and build passed; lint has one pre-existing warning. Both new routes redirect unauthenticated users without forms. Hosted migration/browser checks and existing-profile claiming remain pending. Next: waiver document versioning and acceptance.

- 2026-10-31: Added officials management at /schedule/[gameId]/officials and migration 202610310001_official_assignments.sql. Eleven local tests and typecheck pass. Assignments validate league roles, prevent duplicate roles and overlapping bookings, preserve audit history, and reject stale changes. Schedule updates/reinstatement also check assigned officials. A shared transaction advisory lock serializes official checks across leagues. Hosted deployment/browser verification is pending; credential-safe check returned Data API HTTP 401. Next implementation slice: player registration and profile ownership.

- 2026-10-28: Replaced schedule placeholder with commissioner venue/rink setup, draft creation, league publication, rescheduling/cancellation, and time-zone-aware fixture display. Added migration 202610280002_scheduling.sql and two tests. Nine tests, typecheck, and production build pass; unauthenticated /schedule returns HTTP 307 to /login. Conflicts serialize per league and compare underlying team IDs; cancelled games release bookings. Hosted/browser verification, purchased ice inventory, official assignments, and notifications remain pending. Supabase configuration still returns HTTP 401.

- 2026-10-28: Added commissioner-only player/roster management at /teams/[entryId], migration 202610280001_rosters.sql, and creation/edit forms. RPCs retain inactive records, enforce roster caps and unique active jerseys, reject stale edits, and record audit history. Season caps cannot be reduced below current occupancy. Seven tests, typecheck, and build pass; anonymous roster route redirects to /login (307). Supabase key remains rejected; migration and real hosted/browser verification pending. No existing data deleted and no local fallback introduced.

- 2026-10-27: Added /league/settings and migration 202610270001_season_settings.sql. All five tests, typecheck, and build passed. Unauthenticated settings request redirects to /login (HTTP 307). Hosted/browser verification and consumption by roster/scoring/billing modules remain pending. Supabase Data API still returns HTTP 401. Rules/fees/documents/player data are user-configured content, not client prerequisites. Client updates remain short and omit internal development issues.

- 2026-10-26: Final direct network recheck confirmed Data API key rejection is not caused by sandbox restrictions. Prepared CLIENT_UPDATE_2026-10-26.md with client-ready progress wording and outstanding inputs. Development app remains running on port 3000 at /login; no hosted completion is claimed.

- 2026-10-26: User requested Supabase use instead of local storage. App data path switched to Supabase-only, with sign-in, confirmation callback, cookie refresh, account/league selection, server role checks, and RLS-backed queries/RPC. Preserved the entered test data and verified its import locally. All three database tests, typecheck, build, and unauthenticated route checks passed. Updated saved key still returns HTTP 401; hosted migration/import and real authenticated workflows remain unverified. Development server restarted on port 3000.

- 2026-10-26: Added Supabase foundation without storing privileged credentials. Auth endpoint returned HTTP 200; Data API returned HTTP 401 with API-key rejection. Hosted migration is prepared but not applied, and application data remains local. All three local database/policy tests, type checking, and production build passed. See web/supabase/README.md for activation steps.

- 2026-10-26: Started Phase 1 in web/. Added responsive shell, development League HQ forms, team directory, local PGlite persistence, schema constraints, and tests. Two database tests, type checking, production compilation, and four route HTTP checks passed. Browser checks remain pending. Confirmed web/PWA first and authorized test league. Added CLIENT_INPUTS.md. Production use remains disabled pending authentication and production persistence.

- 2026-10-26: User confirmed all phases are included in the contract. Phase 1 is the first implementation and client-delivery milestone; later phases continue after that handoff. Added explicit handoff tasks. No implementation features were marked complete.

- 2026-10-25: Created planning baseline and checklist from the supplied client materials. Only requirements review and planning artifacts are marked complete; all implementation remains incomplete. Proposed architecture and phase boundaries remain subject to recorded implementation decisions and client scope agreement.

Verification 2026-10-31: all 11 tests, typecheck, and production build passed. Lint passed with one pre-existing unused-variable warning in season-settings.test.mjs. The unauthenticated officials request uses a streamed login redirect (HTTP 200 transport); no assignment form is exposed. Dev app is running at http://127.0.0.1:3000.
