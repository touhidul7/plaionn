# PLAIONN Hockey — Project Plan

Last updated: 2026-11-04
Status: Phase 1 implementation in progress; Supabase application integration implemented, hosted activation/verification pending. Not production-ready.

## 1. Purpose and source material

Build a production hockey platform combining league operations with a public/player hockey network. Start with men's recreational hockey and design the core entities so other adult sports can be supported later.

This plan is derived from the client-supplied `PLAIONN_Hockey_Product_Blueprint.md`, the two identical `plaionn_hockey_prototype.html` files, and the supplied desktop/mobile screenshots. The blueprint is the product vision; it is not evidence that integrations, vendor rights, budgets, or delivery dates have been approved.

The HTML is a standalone concept with sample data and simulated interactions. It contains no production backend, authentication, payments, legally reviewed signatures, offline synchronization, or video playback. It is a visual/workflow reference, not a completed application.

Track delivery in [TODO.md](TODO.md). Update both documents when scope changes.

Implementation update (2026-11-04): User confirmed responsive website/PWA first and authorized a test league. The application in `web/` now uses Supabase-only league queries/mutations with sign-in and membership checks. Hosted activation remains blocked: the configured project host currently fails DNS resolution, so confirm the active URL/key pair before migration/import. Season settings now include commissioner-configurable, audited standings tiebreaker order; application of the migration and standings calculation remain pending. Earlier local test records are preserved for import. See [CLIENT_INPUTS.md](CLIENT_INPUTS.md) for outstanding client information and the current delivery update.

## 2. Product goals

- Reduce league administration and make collections and registration easier.
- Give captains accurate roster, availability, and contribution information.
- Capture trustworthy game events once and reuse them for scores, stats, standings, notifications, and future media.
- Preserve a player's identity and history across teams, leagues, and seasons.
- Provide a responsive public experience for schedules, live games, and results.
- Add optional licensed video and highlights after reliable league operations exist.
- Support independent leagues and group operators without exposing one league's private data to another.

## 3. Scope and delivery boundaries

### Confirmed contract and delivery sequence

The user confirmed on 2026-10-26 that the contract covers all phases. Phase 1 is the immediate implementation priority and first client delivery; later phases remain contracted work, not optional scope exclusions.

Complete the Phase 0 prerequisites needed for Phase 1, implement and verify Phase 1 against its release criteria, and prepare a reviewable client handoff. The user will send that delivery to the client. Continue with Phases 2, 3, and 4 after the Phase 1 handoff. Do not mark Phase 1 complete based on a visual prototype or mocked integrations. Record outstanding external dependencies explicitly.

### Phase 0 — Definition and foundation

Confirm pilot workflows, rulebook, payment ownership, document requirements, and supported clients. Establish the application structure, data model, design system, development environment, and verification workflow.

### Phase 1 — League OS MVP

Deliver one representative pilot league/division end to end:

1. Create league, season, division, venues, teams, and memberships.
2. Register a player, accept approved documents, collect fees, and activate an eligible roster membership.
3. Publish a conflict-checked schedule and assign officials.
4. Capture live goals, assists, and penalties, including a whole game offline.
5. Synchronize saved entries exactly once in effect and broadcast provisional updates.
6. Submit and approve the game sheet; publish official results and standings.
7. Provide public, player, captain, and commissioner views on mobile and desktop.

Minimum tenant isolation must exist in Phase 1 even if the first pilot uses one league. Basic finance access and referee approval are also needed; dedicated advanced portals can follow later.

### Phase 2 — Engagement and expanded operations

Add richer RSVP/lineup tools, substitute discovery, team communication, push/SMS, expanded statistics, career migration, playoffs, sponsor content, and retention analytics. Add operational modules in individually scoped increments rather than assuming every blueprint feature belongs in the MVP.

### Phase 3 — Video pilot

Integrate one approved rink feed. Implement ingestion, clock mapping, clip processing, editor review, permission checks, story playback, personalized clips, and sponsor overlays. The system remains usable without footage.

### Phase 4 — Network and commercial expansion

Expand to cross-league discovery and rankings, tournaments, group reporting, acquired-league onboarding, white-label sites, subscriptions, and optional paid media. Broader sport support is a future extension, not a Phase 1 deliverable.

The blueprint's timing ranges are planning inputs only. Estimate releases after discovery, scope agreement, staffing, and integration feasibility checks. No delivery date or budget is committed here.

## 4. Users and permissions

| Role | Main access |
| --- | --- |
| Visitor/fan | Authorized public schedules, scores, standings, teams, profiles, and media |
| Player | Own registration, private profile, consent, payments, teams, RSVP, stats, and clips |
| Captain/manager | Assigned team roster, eligibility status, availability, contributions, and communication |
| Timekeeper | Assigned games, eligible rosters, event entry, audited corrections, and submission |
| Referee | Assigned game sheets, sign-off, and incident reports |
| Commissioner | Tenant-scoped season setup, scheduling, collections, officials, discipline, and publishing |
| Finance operator | Authorized invoices, reconciliation, refunds, and reports; restricted document access |
| Media editor | Authorized footage, synchronization, clip review, and publication |
| Group operator | Contractually authorized multi-league administration and reporting |
| Arena partner | Facility-scoped inventory and integration information |

A person may hold multiple roles. Context switching must not create duplicate accounts or bypass server-side permissions. Administrative access is scoped, not automatically unrestricted.

## 5. Functional workstreams

User clarification: rules and fees are configured through league/season panels. League admins upload/version waiver documents; users create teams and register players. Actual content and existing data are not development prerequisites. Imports are optional; use test data during implementation.

2026-10-27: Season settings panel and migration cover roster limits, registration dates, periods/clock mode, standings points, billing model, currency, and fees, with commissioner permissions, revision checks, and audit history. Five tests and typecheck/build pass. Hosted/browser verification and downstream enforcement remain pending; this does not complete the rule engine or payments.

### Identity, tenancy, and onboarding

2026-10-28 implementation: commissioner-managed unclaimed player profiles and team-entry rosters now support position, optional jersey number, active/inactive status, revision checks, and audited changes. Player IDs are stable and matching names are not automatically merged. Private roster access remains commissioner-only until scoped captain access and player identity claiming are implemented. Configured season caps are enforced on roster changes and cannot be reduced below existing occupancy. Seven local tests and build/typecheck pass; hosted/browser verification is pending.

- Account signup/login, recovery, session management, and privileged-account MFA.
- Persistent person/player identity; league memberships and role assignments.
- Player registration, invitations, captain approval, free-agent/spare registration, and eligibility checks.
- Versioned waivers, conduct documents, separate filming/marketing permissions, consent history, and withdrawals.
- Profile privacy, account controls, and authorized data export/deletion workflows.

### League administration and scheduling

2026-10-28 implementation: venue/rink creation and time zones, same-division game creation/editing, draft visibility, scheduled league-member visibility, and cancellation/rescheduling with audited reasons. Per-league serialized database writes prevent team/rink conflicts; cancelled games release slots and back-to-back bookings are allowed. Venue-local dates convert to UTC; missing/ambiguous DST times are rejected rather than silently shifted. Nine local tests and build/typecheck pass. Hosted/browser verification, shared cross-league physical-venue inventory, purchased ice slots, officials, notifications, and public schedule publication remain pending.

- League branding, seasons, divisions, team entries, roster rules, and registration windows.
- Venues, rinks, available ice blocks, game scheduling, changes, cancellations, and conflict detection.
- Officials' assignments and basic availability handling.
- Configurable game formats, point allocations, tiebreakers, forfeits, and approval policies.
- Later: optimized scheduling, ice contracts/utilization, certification tracking, payroll exports, advanced discipline/appeals, support CRM, and renewal campaigns.

### Payments and accounting

- Support a defined launch billing model, with the data model allowing team billing and direct player billing.
- Separate team-to-league liability from player-to-team contribution accounting.
- Invoices, line items, deposits/installments where agreed, credits, refunds, receipts, and reminders.
- Hosted provider checkout; verified provider events settle balances.
- Idempotent payment processing, webhook retries, reconciliation, and authorized offline receipts.
- Tenant-specific financial reporting and audited adjustments.
- Later: partner payouts, officials' payroll, merchandise accounting, SaaS billing, and paid media entitlements.

### Scoring, results, and statistics

- Pre-game roster checks, scratches, starting goalie, and approved call-ups.
- Large-target tablet scoring controls for goals, assists, penalties, periods, and game status.
- Additional shots, saves, goalie changes, and derived goalie metrics only where input quality supports them.
- Device timestamps and rink-clock readings; distinguish local display clocks from physical clock integration.
- Durable offline queue, sync status, duplicate prevention, and conflict review.
- Audited corrections instead of destructive deletion of official events.
- Submission, referee/commissioner approval, incident handling, and controlled reopening.
- Live score, timeline, provisional box score, projected standings, and official standings.
- Rebuild derived statistics from approved results; explain configurable tiebreak outcomes.

### Public, player, and captain experiences

- Home dashboard, league/season context, schedules/results, Game Centre, standings, and team pages.
- Player passport, current memberships, season/career stats, balances, and document status.
- Captain roster management, outstanding requirements, contribution balances, and reminders.
- Basic availability for pilot needs; later expand to lineup tools, spare marketplace, calendar subscriptions, chat, polls, and volunteer tasks.
- Later: jerseys/orders, awards, free agency, follows, and personalized engagement.

### Media, content, and network

- Explicit no-video/unavailable states in Phase 1.
- Later: licensed ingestion, assets, game-clock mapping, processing jobs, editor review, clips, reels, and signed playback.
- Clip statuses: awaiting video, processing, needs review, published, and blocked.
- Story segments correspond to plays, with event-derived player/team/sponsor overlays.
- Separate permissions for recording, streaming, clipping, marketing, and archival.
- Later: league CMS, sponsor campaigns/metrics, tournaments, regional rankings, white-label domains, and consolidated group dashboards.

## 6. Critical workflows and invariants

### Registration to game eligibility

Account/profile → league/season selection → required documents and separate consent → payment requirements → roster approval → eligibility → published schedule and game participation.

Eligibility rules must be explicit. Any override requires an authorized actor and recorded reason. Payment success alone must not bypass other requirements.

### Game event to official result

Scorer saves event → server validates role, game, roster, and deduplication key → event is persisted → provisional projections and subscribers update → officials submit/approve → official projections update.

A correction preserves the original decision and propagates through scores, assists, player stats, standings, notifications where appropriate, and associated media. Reopening or changing an approved result must be controlled and audited.

### Financial settlement

Invoice → provider payment request → verified provider event → ledger entry → updated balance and receipt. Frontend success messages never settle invoices. Repeated requests/events must not duplicate charges or ledger entries.

### Offline recovery

Download assigned game and roster → persist each entry locally → show unsynced state → retry on connectivity → server acknowledges durable events → surface conflicts for review. Offline edits after finalization, multiple devices, expired sessions, and interrupted sync need defined handling.

## 7. Proposed technical direction

Supabase was selected as the hosted PostgreSQL/Auth integration direction on 2026-10-26. Application reads and mutations now use Supabase exclusively, with signup/login/logout, session refresh, membership checks, and commissioner permissions implemented. The local database is preserved only for recovery/import and is no longer an application fallback. Hosted activation remains blocked by HTTP 401 API-key rejection and pending migration/import; real authenticated workflows must still be verified before release.

These are implementation proposals, not locked client requirements. Validate package versions and provider capabilities when implementation begins.

| Area | Proposed approach |
| --- | --- |
| Initial clients | Responsive TypeScript web application/PWA with dedicated tablet scoring layout |
| Web framework | React with Next.js for public pages and authenticated portals |
| Backend | Modular TypeScript backend; decide integrated service versus separate API during foundation work |
| Persistent storage | PostgreSQL with enforced tenant-scoped access policies |
| Domain events | Durable game event log, transactional outbox, background jobs, reproducible projections |
| Live delivery | SSE or WebSocket subscriptions with reconnect and recovery behavior |
| Offline scoring | Durable browser database for PWA; validate device reliability before committing to it for pilot |
| Payments | Provider-backed hosted checkout; merchant/funds flow determines provider configuration |
| Notifications | Email first for required workflows; push/SMS added with preferences and delivery tracking |
| Media | Object storage, video processing/streaming provider, job queue, CDN, signed playback |
| Native apps | React Native/Expo candidate if app-store delivery or offline reliability requires it |
| Operations | Separate environments, CI, migrations, secrets management, monitoring, backups, restore tests |

Avoid unnecessary distributed services initially. Preserve clear boundaries between scoring, financial accounting, media, and identity so each can evolve independently.

## 8. Core data model

- Organization/league tenant, memberships, role grants, and audit records.
- Person, player profile, privacy preferences, and verified identity merge history.
- Season, division, team, season team entry, roster membership, and eligibility decision.
- Venue, rink, ice block, game, official assignment, and game participation.
- Game event, correction/revision, official score sheet, approval, and incident case.
- Registration, document/waiver version, signature evidence, and consent record.
- Invoice, invoice item, payment request, provider event, ledger entry, credit, and refund.
- Notification, preference, announcement, RSVP, and later messages/follows.
- Video asset, rights record, clock mapping, clip job, clip, and reel.
- Sponsor campaign, placement, tournament, import batch, and source provenance as later phases require.

Game events are persisted independently of statistics/standings projections. Money has a separate ledger. Imported historical records retain source, completeness, and verification status; identities are not merged by name alone.

## 9. Design and accessibility

Use the client's dark navy surfaces, lime primary actions, muted secondary text, scoreboard cards, desktop sidebar, and mobile layout as the starting design language.

- Make navigation role-aware and practical for small screens.
- Support mobile, desktop, and tablet layouts, including long names and large tables.
- Provide clear loading, empty, error, unavailable, pending, and offline states.
- Clearly distinguish demo, live/provisional, submitted, and official records.
- Use accessible contrast, keyboard navigation, visible focus, form labels, and touch targets.
- Never imply a payment, signature, notification, or video exists when it is only simulated.

## 10. Security and operational requirements

- Enforce authorization and tenant boundaries on every sensitive server operation.
- Protect private profiles, financial information, waiver evidence, and incident footage separately.
- Use hosted card entry; never store raw card details.
- Protect secrets, validate inputs, rate-limit sensitive endpoints, and audit privileged changes.
- Establish retention, consent withdrawal, media takedown, and incident response workflows.
- Obtain client-approved waiver/legal text and policy decisions; engineering implementation is not legal approval.
- Encrypt transport and sensitive storage; test backups and recovery before pilot launch.
- Monitor failed payments/webhooks, queue failures, scoring sync lag, and realtime disconnections.

Healthy-network live score freshness target: P95 under two seconds. Offline target: retain a whole game's saved events and recover without loss. These require measurement and are not guarantees before pilot testing.

## 11. Verification and release gates

Use focused unit tests for scoring/tiebreak rules and ledgers; integration tests for permissions, persistence, approval/correction flows, and provider events; end-to-end checks for essential user journeys. Test offline scoring on actual intended devices and realistic rink connectivity.

Phase 1 cannot be considered complete until:

- A player registers, accepts documents, pays, and joins an eligible roster end to end.
- A captain sees correct team and player obligations without card information exposure.
- A commissioner publishes a schedule without hidden team/rink conflicts.
- An assigned scorer records a game offline and synchronizes without loss or duplicate effects.
- Multiple connected viewers receive provisional score/stat updates.
- Approval and later authorized correction produce correct reproducible official standings.
- Unauthorized cross-team/cross-league operations are rejected.
- Mobile/desktop controls and critical accessibility checks pass.
- Unavailable video and incomplete historical data are represented honestly.
- Backup restoration, deployment rollback, monitoring, and operational ownership are demonstrated.
- Pilot staff complete at least one real end-to-end operating cycle and record acceptance.

Track adoption, onboarding completion, digital scoring coverage, sync freshness, payment collections, admin workload, and renewal behavior. Establish pilot baselines before treating blueprint KPI targets as commitments.

## 12. Decisions and dependencies still open

| Decision | Why it matters | Needed by |
| --- | --- | --- |
| Budget, staffing, and launch date | All phases are contracted; these details determine delivery estimates | Before delivery-date commitments |
| Pilot league and approvers | Real operating validation; rules/content are entered through panels | Before pilot acceptance, not implementation |
| Web/PWA launch | Confirmed by user; native apps are not required initially | Resolved |
| Billing model, merchant ownership, currency/taxes, refunds | Determines funds flow and ledger integration | Before production payments |
| League-owned waiver text | Uploaded/versioned by admins through the document workflow | Before real registration, not development |
| Optional existing data import | Users create teams/players in-app; imports only when requested | Before optional migration |
| Hosting, environments, domain, and account ownership | Determines deployment and operations | Before shared deployment |
| Email/SMS/push provider and communication rules | Determines delivery channels and cost | Before notifications launch |
| Video feed, contracts, publication rights, and costs | Determines feasibility and latency | Before video pilot |
| Financial visibility and cross-league sharing rules | Determines tenant/group permission boundaries | Before group reporting |

Do not block independent local development on credentials that are not yet needed. Mock integrations must remain clearly labeled and cannot satisfy production acceptance criteria.

## 13. Implementation and tracking workflow

1. Resolve the next milestone's necessary decisions and record assumptions.
2. Implement a small working vertical slice with real persistence and access control.
3. Verify its behavior and failure cases appropriate to its risk.
4. Update TODO statuses and record material limitations or follow-up work.
5. Demonstrate the slice before expanding to dependent features.

Recommended first implementation slice: application shell → authentication and tenant context → league/season/division/team setup → persisted roster → one scheduled game. Build registration/payments and scoring/approval next, then integrate the public and role-specific dashboards around real data.

Keep later-phase items visible as contracted work scheduled after the Phase 1 client handoff. They are not requirements for the first delivery. Any agreed scope reduction or sequence change must be reflected in this plan and the checklist.

### Implementation update ? 2026-10-31

Officials assignment is implemented as the next scheduling slice: commissioner crew management, role eligibility, retained audit history, stale-write protection, and overlap checks during both assignment and fixture changes. Slots currently support one timekeeper and two referees. Shared-account overlaps are checked across leagues without exposing fixture details. Account role onboarding and official scoring/approval access remain separate work. Local tests pass; hosted migration and browser acceptance are pending. Next slice: player registration and secure ownership/claiming of profiles, followed by document acceptance and eligibility.

### Registration implementation update - 2026-10-31

The new-profile registration slice now supports deliberate season publication, inclusive UTC windows, applications from signed-in accounts without membership, account-owned global profiles, commissioner decisions, applicant withdrawal, and private audit history. Approval adds league membership and a player association; roster assignment/payment/waiver/eligibility remain separate. Existing-profile claiming and application edits/resubmission are not included in this slice. Thirteen local tests and production compilation pass; hosted/browser acceptance is pending. Next slice: league-managed waiver document versions and player acceptance.
