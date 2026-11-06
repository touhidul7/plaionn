# Client preview status - 2026-11-06

Current public probe: Auth HTTP 200; 20/22 private tables present/anonymous-denied. Scoring tables are absent. Run `verify-client-preview.sql` to inspect required schema, apply missing migrations in order, and see [deployment guide](../../VERCEL_DEPLOYMENT.md) for confirmed reviewer/demo setup. Prepared files have not been executed against the hosted project by this review. Earlier dated entries below are historical.

# Supabase activation and verification

## Current status — 2026-11-04

The application now uses Supabase Auth and Supabase-only league operations. The local PGlite adapter was removed from application code; the original database is preserved.

The app accepts a current `sb_publishable_` key or the legacy anon JWT (role `anon`); it rejects secret/service-role keys. The REST OpenAPI root (`/rest/v1/`) can return `Secret API key required` and is not a suitable public-key check. The connection checker probes all 22 private tables using zero-row requests. `permission denied for table` means the public key was accepted and the database correctly denied anonymous table access; missing tables, rejected keys, or anonymous access produce explicit failures. Supabase's current API-key documentation says publishable and legacy anon keys both provide the public `anon` role; do not put a secret key in this app.

The hosted public-key check verified the 20 tables deployed before the scoring slice. Migration `202611040002_game_events.sql` is new and has not been verified on the hosted project; apply it before expecting the updated checker to pass. Successful hosted login and authenticated writes remain unverified without a signed-in test account.

## 1. Correct the project configuration

From the same project's Connect dialog, copy the complete Project URL and publishable key into web/.env.local:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

Run npm.cmd run supabase:check from web/. The script never prints credentials or raw response bodies. Password, secret, and service-role keys are not needed by the application clients.

## 2. Apply the database migration

Apply 202610280002_scheduling.sql fourth. It adds venues, rinks, game fixtures, schedule audit history, commissioner-only RPC writes, and league-scoped team/rink conflict checks. Nine local tests pass with all four migrations. Hosted execution is still pending.

2026-10-28: Apply 202610280001_rosters.sql third, after the foundation and season-settings migrations. It adds stable unclaimed player profiles, league associations, private commissioner-only team-entry rosters, capacity enforcement, and audit history. No hosted deployment of this migration is claimed. Seven local tests pass; authenticated hosted and browser checks remain pending.

An earlier public-key probe confirmed the first 20 tables. The latest review found the scoring tables absent. For a fresh project or a reset, apply migrations in filename order:

1. `202610260001_league_foundation.sql`
2. `202610270001_season_settings.sql`
3. `202610280001_rosters.sql`
4. `202610280002_scheduling.sql`
5. `202610310001_official_assignments.sql`
6. `202610310002_registration.sql`
7. `202611040001_standings_tiebreakers.sql`
8. `202611040002_game_events.sql`
9. `202611060001_scored_matchup_guard.sql`

All pass the local test harness. Hosted table presence and anonymous denial are verified through the standings migration; the scoring migration is pending hosted deployment. Authenticated reads/writes and migration policies still need verification using real signed-in accounts.

The latest migration adds an ordered, five-criterion tiebreak list to `season_settings`. It is commissioner-editable and covered by the existing settings audit trigger. Apply this migration before saving the new settings form.

## Provisional game scoring (2026-11-04)

Apply `202611040002_game_events.sql` after the standings migration. It adds append-only goal/penalty events, reasoned void records, and RPCs for assigned timekeepers/commissioners to record events and referees/commissioners to correct them. Database checks validate game assignment, active roster membership, season period/clock limits, assist eligibility, penalty duration, and idempotent retries. The score shown in the scorekeeping page excludes voided events and is provisional only; final-result approval, live broadcasts, offline operation, and official standings are separate work.

The migration has been tested with the local PGlite suite but is not yet reported as applied to hosted Supabase. After applying it, rerun `npm.cmd run supabase:check` from `web/`; the check now expects 22 private tables.

Review and run migrations/202610260001_league_foundation.sql once in the development project's SQL editor, or use an authorized migration connection. It creates:

- leagues, memberships, seasons, divisions, teams, and team entries;
- tenant-scoped row-level security;
- authenticated read access to a user's own league setup;
- commissioner-only record creation;
- an atomic create_team_with_entry function.

Anonymous data access and self-assigned memberships are denied. The migration fails instead of overwriting existing tables. Apply only to the intended development project after checking for existing schema conflicts.

The local RLS test simulates Supabase Auth identity/roles. Hosted anonymous denial is verified for all 20 tables. Real authenticated role and tenant isolation policies still require verification.

## 3. Restore the team already entered locally

The existing records were preserved in:

`../.data/exports/2026-10-25T18-35-13.046Z/import-to-supabase.sql`

Run that SQL after the schema migration. It restores one season, one division, one team, and one team entry, retaining their IDs. Matching IDs are left unchanged; other conflicts roll back the import. The export passed a dry-run import against the new schema. Do not delete the original local database until the hosted result is verified.

## 4. Configure Auth and create the test account

In Supabase Auth URL configuration, allow the actual app origin and confirmation callback:

- Development site URL: http://127.0.0.1:3000
- Allowed redirect: http://127.0.0.1:3000/auth/callback

Use http://127.0.0.1:3000/login to create an account. Complete any required email confirmation in the same browser, then sign in. No account automatically becomes a commissioner. Production email delivery, password recovery, MFA, and invitation workflows remain upcoming work.

## 5. Assign the intended commissioner

After signup, use the real account UUID from the account page or Supabase Auth user list:

```sql
insert into public.league_memberships(league_id,user_id,role)
values(
 '00000000-0000-4000-8000-000000000001',
 'REPLACE_WITH_AUTH_USER_UUID',
 'commissioner'
);
```

This is an explicit project-owner operation. Ordinary users cannot grant themselves roles. Open Account → Open league after assignment. Multiple memberships are selected through the account page, and the server checks membership before honoring the selected league cookie.

## 6. Verify hosted behavior

- Sign in and open the restored team directory.
- Create a season/division/team; confirm records exist in Supabase Table Editor.
- Restart the app and confirm data remains available.
- Test sign-out, confirmation, and token refresh.
- Verify a player cannot create records or promote themselves.
- Verify a second league's user cannot read or write the first league's records.
- Confirm errors never save to a local database.

## Security notes

Only the publishable key is configured. Clients use the signed-in user's session; no service-role bypass exists. Privileged credentials previously shared in chat should be rotated by the account owner; the assistant has not performed rotation.

The session proxy refreshes cookies. Server Components validate the user independently; Server Actions check verified membership and commissioner permissions, backed by RLS. Pages with session data must not be publicly cached.

References: [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).


## Officials module (2026-10-31)

Commissioners use Schedule ? Officials to assign or remove one timekeeper and up to two referees. Eligible accounts must already have the matching league membership role; the module does not grant roles or send invitations. For development, the project owner can assign `referee` or `timekeeper` using the same membership SQL pattern above with the intended account UUID. The directory exposes account email only to commissioners.

Assignment RPCs check roles, game ownership, revisions, and booking overlaps across leagues without exposing another league's fixture details. Drafts reserve officials; cancellation releases the time but retains assignments/history. Reinstatement and rescheduling recheck conflicts. Official reads exclude drafts and other people's assignments; future scoring/approval operations must add their own assignment checks.

Schedule writes take a league lock, then a shared advisory transaction lock for official checks; assignment writes follow the same order. This conservative serialization should be load-tested before larger rollouts. Eleven local tests cover validation, privacy, role denial, duplicates, conflicts, cross-league bookings, cancellation/reinstatement, removal audit, and stale updates. Hosted concurrent-write and browser tests are pending.

## Player registration (2026-10-31)

Apply migration `202610310002_registration.sql` after the officials migration. Commissioners open League HQ > Manage registration, configure both dates via Season settings, and publish applications. Publication defaults off, is audited through season settings, and uses inclusive UTC dates. Only names and registration dates of open seasons are discoverable by signed-in users without league membership.

Applicants use `/registration`, submit a preferred position, and receive a pending application. First submission creates an account-owned global player profile; further seasons reuse it. Existing commissioner-created profiles are not claimed or merged based on names. An applicant can withdraw a pending request. Commissioners approve/reject through `/league/registrations`; approval grants the player role and league-player association atomically, but never inserts a roster member or asserts payment/waiver/game eligibility. Applicant-visible reasons and transitions are audited. One application per account/season is allowed, including after withdrawal/rejection; edits/resubmission and existing-profile claims are future work.

Verification: 13 local tests pass, including account ownership, matching-name separation, duplicate rejection, date windows, atomic rollback, cross-league denial, review permissions, private history, stale decisions, and no automatic roster activation. Typecheck and production build pass. Both routes send unauthenticated visitors to login without forms. Real hosted/browser and concurrent-transaction verification are pending.
