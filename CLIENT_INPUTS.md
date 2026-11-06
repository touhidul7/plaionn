# PLAIONN — Configuration and External Dependencies

Updated: 2026-10-28. Internal planning document.

## Configured through the software

- Commissioners set rules, roster limits, registration dates, fees, and billing models.
- League admins upload/version their own waiver and consent documents.
- Commissioners/captains create teams and manage rosters; players register themselves.
- Existing team/player data is only needed for an optional import.

These are features to build, not prerequisites to request from the client. Use test data during development.

## Current progress

Scheduling update: venue/rink setup, game drafts, league schedule visibility, rescheduling/cancellation, venue time zones, and team/rink conflict prevention are implemented. Nine tests and typecheck/build pass locally. Officials, ice inventory, notifications, public fan access, and hosted/browser verification remain pending.

Added commissioner player/roster management with jersey numbers, positions, active/inactive status, season-cap enforcement, duplicate jersey prevention, and retained audit history. Seven local tests, typecheck, and build pass. Captain access, player self-registration, and hosted/browser verification remain pending. The latest Supabase connectivity check still returns HTTP 401; this is an internal issue, not client-update content.

Dashboard, league setup, team directory, and Supabase-only app integration are implemented. A season settings panel now covers roster limits, registration dates, periods/clock mode, standings points, and fees. Changes require commissioner access and retain an audit history. Five local tests, typecheck, and build pass.

Hosted/browser verification and use of these settings by future roster/scoring/billing modules remain pending. The hosted API key still returns HTTP 401; migrations/import are prepared but not applied by the assistant. See web/supabase/README.md. No local fallback exists.

## External dependencies — request only when needed

- Valid Supabase configuration and authorized migration access for hosted activation.
- Payment-provider account and merchant/funds-flow setup before real payments.
- Hosting/domain/email-provider access before shared deployment and notifications.
- Pilot reviewer and test devices before acceptance.
- Licensed arena/video access before the later video phase.

Use secure invitations/configuration for access. Do not request secrets in client messages.

## Client communication

Keep updates short: features built, current development area, and next work. Omit routine technical debugging and requests for user-configurable data. Do not imply features are released or fully verified when they are not.
