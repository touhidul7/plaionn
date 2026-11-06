# Client preview deployment

Reviewed: 2026-11-06. This is a Phase 1 progress preview, not the completed Phase 1 release.

## Current readiness

- Source includes league setup, season settings/tiebreaker configuration, rosters, scheduling, officials, player registration/review, and provisional scoring/corrections.
- Live public-key check: Auth HTTP 200; 20/22 private tables present and denying anonymous access. `game_events` and `game_event_voids` are missing from the configured Supabase project.
- The Vercel project/domain and reviewer accounts have not been configured by this review. No deployment has been made.
- Hosted authenticated workflows require a final smoke test before sharing with the client.

## 1. Prepare Supabase

Use the test/development project for the client preview. In Supabase SQL Editor, run `web/supabase/verify-client-preview.sql` to see missing schema pieces. Check which migrations have already been applied; do not rerun table-creation migrations over existing tables.

Full order for a fresh database:

1. `202610260001_league_foundation.sql`
2. `202610270001_season_settings.sql`
3. `202610280001_rosters.sql`
4. `202610280002_scheduling.sql`
5. `202610310001_official_assignments.sql`
6. `202610310002_registration.sql`
7. `202611040001_standings_tiebreakers.sql`
8. `202611040002_game_events.sql`
9. `202611060001_scored_matchup_guard.sql`

For the current project, the scoring migration is definitely missing. Check whether the tiebreaker column already exists before applying migration 7; then apply 8 and 9. All files are under `web/supabase/migrations/`.

Afterwards run the read-only verification SQL again: expect **zero issue rows**. From `web`, run `npm run supabase:check`: expect Auth HTTP 200 and **22/22** private tables. These checks do not prove authenticated policies or email delivery work.

## 2. Import into Vercel

The current folder is not a Git repository. Push the project to your Git provider first, keeping `.env.local`, `.data`, `node_modules`, and `.next` excluded by the supplied ignore files. Import that repository in Vercel.

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `web` (if repository contains this whole project) |
| Node.js | `22.x` |
| Install | `npm ci` |
| Build | `npm run deploy:check && npm run build` |
| Output | Framework default; do not use static export |

If your repository contains only the contents of `web`, keep Root Directory at the repository root. `web/vercel.json` supplies the install/build settings. `package.json` pins Node 22.

Alternatively, from the `web` folder use the Vercel CLI: `npx vercel login`, `npx vercel link`, configure the project environment variables in the dashboard, then `npx vercel --prod`. For this CLI layout, use the current directory as the Vercel project root. Do not set `web/web` accidentally.

Set the intended stable project domain before the first build, e.g. `https://YOUR-PROJECT.vercel.app`.

## 3. Set Vercel environment variables

Add these to the environment you will deploy (Production for the stable client URL):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLIC-KEY
NEXT_PUBLIC_APP_URL=https://YOUR-VERCEL-PROJECT.vercel.app
```

The app also supports `NEXT_PUBLIC_SUPABASE_ANON_KEY` or the existing `NEXT_PUBLIC_ANON_KEY` for a legacy anon key. Configure **one valid public key variable**, using the key that currently passes `supabase:check`; a publishable key is not mandatory. Never put a secret/service-role key or database password in a `NEXT_PUBLIC_` variable.

`NEXT_PUBLIC_APP_URL` must be the exact HTTPS site origin, without `/login`, credentials, query parameters, or localhost. The deployment preflight rejects an unsuitable origin. Public environment values are bundled at build time, so redeploy after changing them.

For a separate Vercel Preview environment, configure the corresponding stable preview origin and allowed Supabase redirect explicitly. Do not assume a dynamically generated preview URL will automatically work for confirmation links.

## 4. Configure Supabase Auth URLs

Under Authentication > URL Configuration:

- Site URL: `https://YOUR-VERCEL-PROJECT.vercel.app`
- Redirect URL: `https://YOUR-VERCEL-PROJECT.vercel.app/auth/callback`
- Keep the localhost callback only for local development if needed.

Test email confirmation from the deployed site in the same browser that initiated signup. Check your Supabase email delivery configuration before relying on client signup. For a guided review, you may create confirmed test accounts through Supabase Auth's admin dashboard, then assign their application roles as described below. Share passwords privately, never in source files.

## 5. Prepare client data and access

1. Create/confirm an account for the client in Supabase Auth. A normal signup grants no commissioner role.
2. Open `web/supabase/demo/client-preview.sql` in SQL Editor. Replace `REPLACE_WITH_CLIENT_EMAIL` with that confirmed account's email, review, and run it.
3. The script creates a separate **PLAIONN Client Demo** league, one season/division, Northline HC and Harbour Wolves, six active fictional players, a rink, and one scheduled game. It grants that account commissioner access only to the demo league.
4. The registration window runs from the seed date for 30 days. Re-running the script preserves edits and does not reset dates or scores; extend the window through Season settings if needed.
5. In My account, choose PLAIONN Client Demo > Open league. Existing development data is not changed.

For role-specific testing, create separate confirmed timekeeper and referee accounts and run the following after replacing the email and role. Use only `timekeeper` or `referee` here, then assign the account via Schedule > Officials. Check that SQL reports one inserted row; a missing email inserts nothing.

```sql
insert into public.league_memberships(league_id,user_id,role)
select '60000000-0000-4000-8000-000000000001',id,'timekeeper'
from auth.users where lower(email)=lower('REPLACE_WITH_CONFIRMED_OFFICIAL_EMAIL')
and email_confirmed_at is not null
on conflict do nothing;
```

A second browser/private window with a separate player account can test registration without a preassigned membership. Commissioner approval grants player membership; roster assignment is a separate action.

## 6. Before sending the link

- Confirm any Vercel deployment protection permits the client to open the link; Vercel access and the app's login are separate.
- Sign in as the reviewer, choose the demo league, and open all main sections.
- Record a goal, refresh, and verify it persists. Void it with a reason and verify the score reverses.
- Submit an application from a separate player account; approve it as commissioner and verify the player's league access.
- Test one assigned timekeeper and referee if those roles are included in the demo.
- Sign out and confirm protected pages redirect to login.
- Open on a phone and check navigation, forms, and horizontally scrollable tables.
- Record the final URL and actual test results in `TODO.md`. Do not mark hosted acceptance complete based only on the local build.

Give the client `CLIENT_TEST_GUIDE.md` with their actual URL and securely supplied account credentials.

References: [Vercel project settings](https://vercel.com/docs/project-configuration/general-settings), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [environment variables](https://vercel.com/docs/environment-variables), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
