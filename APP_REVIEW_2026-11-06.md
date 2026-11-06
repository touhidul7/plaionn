# App and checklist review

## Reviewed scope

Reviewed application routes, auth/session/configuration, database migrations and policies, existing tests, the checklist, and deployment requirements. Preserved the added tiebreaker and scoring work. This review prepares a client progress preview, not a Phase 1 completion claim.

| Feature | Current implementation | Demo constraint |
| --- | --- | --- |
| League/season/division/team setup | Creation and authenticated directory | General editing/deletion is incomplete |
| Season rules | Roster limits, clock/periods, points, fees, registration dates, tiebreaker order | Tiebreakers are configured but standings calculation is not implemented |
| Rosters | Profiles, jerseys, positions, active/inactive, caps, history | Existing-profile claims, captain onboarding, eligibility and imports incomplete |
| Schedule | Venues/rinks, zones, drafts, publish, edits, cancellation, conflicts | No ice inventory, automated generation or notifications |
| Officials | Assignment, overlap checks, role checks, history | Accounts/roles must be provisioned by the project owner |
| Registration | Publication, applications, review, withdrawal, owned profiles | No waivers, resubmission, historical-profile claim or payment checkout |
| Scoring | Assigned timekeeper entry, commissioner/referee voids, provisional score | Hosted scoring migration missing at review time; no final approval, standings, realtime broadcast or offline sync |
| Auth | Signup, confirmation, login/logout, league selection, session checks | Recovery/MFA and real hosted role tests pending |
| Responsive shell | Desktop/mobile styles and scrollable tables | Authenticated visual/device acceptance pending; not an installable/offline PWA yet |
| Later phases | Tracked in checklist | No engagement/media/network release claim |

## Fixed during this review

- Moved dashboard routes into an authenticated `(portal)` layout and made login a standalone centered screen. URLs are unchanged.

- Added Vercel configuration and Node 22 selection, deploy-time environment checks, and explicit HTTPS confirmation-origin validation.
- Added safe demo provisioning SQL and a read-only schema verification query.
- Restricted scoring form display to commissioners/timekeepers; referees retain correction controls.
- Filtered scoring players/assists by team, excluded duplicate actors, and separated goal/penalty inputs.
- Added a database guard against replacing game teams after events exist.
- Reset the scoring form after a successful event; repaired schedule table column consistency.
- Updated stale dashboard wording and preview labeling; disabled search-engine indexing for the preview.
- Added deployment and client testing guides; fixed the existing lint warning.

## Hosting findings

The configured Supabase key is now accepted. The live check returned Auth HTTP 200 and 20/22 private tables present/anonymous-denied. The scoring tables are absent. Tiebreaker-column and guard-trigger presence should be checked with `verify-client-preview.sql`; table counts alone do not verify them.

The workspace has no Git repository or linked Vercel project. No Vercel account, deployment domain, or authenticated reviewer session was available to this audit. Deployment, remote migrations, demo seeding, and hosted account tests have not been performed. The prepared SQL must be run by the project owner against the intended test project.

## Verification

All 18 tests, production build/TypeScript, and lint pass. Production HTTP checks cover the login page and nine protected routes. The desktop login was visually checked in Chrome. Authenticated and mobile layouts have not been visually verified. Local database tests use a Supabase-role simulation; they do not substitute for the deployed two-account smoke tests in VERCEL_DEPLOYMENT.md. Existing local data/export files were not changed.
