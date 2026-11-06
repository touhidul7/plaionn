# PLAIONN — Client Progress Update

Date: 26 October 2026

## Message ready to send

Hi,

We have started Phase 1 of PLAIONN Hockey, with the first delivery focused on the responsive web application for desktop, mobile, and scoring tablets.

The initial application structure and branded interface are in place, including the dashboard, League HQ, and team directory. We have implemented the season → division → team setup flow and successfully tested creating a team in the development environment.

We have also implemented the Supabase connection code, account sign-in/registration flow, session handling, league selection, and commissioner access checks. The database schema and league-level access policies are prepared. Supabase project configuration and schema activation still need to be completed before we can verify live cloud sign-in and saved records. Existing development test data has been preserved for import.

The current build, type checks, and local database/access-policy tests are passing. This is an initial implementation milestone, not the completed Phase 1 release. After hosted verification, the next work is completing league and roster management, scheduling, registration/waivers/payments, and live/offline scoring with approved results and standings.

To configure the system for your pilot league, please share the following when available:

1. Pilot league details: league name, timezone, season dates, divisions, team list, and primary administrator.
2. Hockey rules: game/period formats, overtime/ties, standings points and tiebreakers, penalties, forfeits, and who approves or corrects game results.
3. Registration rules: roster limits, player eligibility, spare/goalie rules, deadlines, and any existing roster/schedule exports.
4. Approved documents: waiver, code of conduct, privacy notice, and separate filming/marketing consent requirements.
5. Payment setup: team versus individual billing, fees/currency, deposits/installments, taxes/refunds, and the legal entity/payment account receiving funds. The design supports both billing models described in the blueprint.
6. Delivery setup: hosting/domain ownership, email sender/provider, intended scoring devices, and the person who will review and accept the Phase 1 pilot.

Please provide access through account invitations or secure configuration rather than sending passwords or secret keys by email/chat. We can continue independent development while these details are collected.

We will complete and verify Phase 1 for your review before moving on to the remaining contracted phases. We will confirm delivery estimates once the pilot rules and integration requirements are settled.

Thank you.

## Internal developer notes — omit from the client message

- App: http://127.0.0.1:3000/login. This is a local development URL, not a client-accessible staging deployment.
- The saved Supabase publishable key is rejected with HTTP 401 by the Data API. A direct network recheck confirmed the same result. The project URL/key must be corrected before claiming a working connection.
- Hosted migration: web/supabase/migrations/202610260001_league_foundation.sql. Not yet applied by the assistant.
- Preserved test data import: web/.data/exports/2026-10-25T18-35-13.046Z/import-to-supabase.sql. Dry-run import passed; hosted import remains pending.
- After signup, the intended admin needs an explicit commissioner membership. See web/supabase/README.md.
- No successful hosted signup/login/write is claimed; browser interaction checks also remain pending.
- Password recovery, MFA, full role coverage, rosters, scheduling, payments, scoring, and offline PWA functionality are not complete.
- Rotate the privileged credentials shared earlier. Do not include them or the local .env.local file in a client update.
