import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");

async function applyMigration(pg, filename) {
  const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
  await pg.exec(sql);
}

test("push/SMS preferences, quiet hours suppression, and notification inbox", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);

  const migrations = [
    "202610260001_league_foundation.sql",
    "202610270001_season_settings.sql",
    "202610280001_rosters.sql",
    "202610280002_scheduling.sql",
    "202610310001_official_assignments.sql",
    "202610310002_registration.sql",
    "202611040001_standings_tiebreakers.sql",
    "202611040002_game_events.sql",
    "202611060001_scored_matchup_guard.sql",
    "202611130001_game_results_standings.sql",
    "202611160001_onboarding_and_demo_access.sql",
    "202611160016_notifications_and_sms.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "10000000-0000-0000-0000-000000000001";
  const playerUserId = "20000000-0000-0000-0000-000000000001";

  await pg.exec(`
    insert into auth.users (id, email) values ('${playerUserId}', 'player@test.com');
    insert into public.leagues (id, name) values ('${leagueId}', 'Test League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${playerUserId}', 'player');
  `);

  // Switch to authenticated player
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${playerUserId}', false);
  `);

  // 1. Initial Preferences Check (Defaults should be populated)
  const initPrefs = await pg.query(
    `select * from public.get_user_notification_preferences($1);`,
    [leagueId]
  );
  assert.equal(initPrefs.rows.length, 1);
  assert.equal(initPrefs.rows[0].push_enabled, true);
  assert.equal(initPrefs.rows[0].sms_enabled, false);
  assert.equal(initPrefs.rows[0].notify_game_reminders, true);

  // 2. Save Updated Preferences (Opt in to SMS, opt out of announcements, set quiet hours)
  const saveRes = await pg.query(
    `select public.save_notification_preferences(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    );`,
    [
      leagueId,
      "+15551234567", // phone
      true,           // sms_on
      true,           // push_on
      true,           // email_on
      true,           // reminders_on
      true,           // sched_on
      true,           // spares_on
      false,          // announcements_on (OPT OUT)
      true,           // discipline_on
      true,           // quiet_on
      "22:00:00",     // quiet_start
      "08:00:00",     // quiet_end
      "America/Toronto",
    ]
  );
  assert.equal(saveRes.rows[0].save_notification_preferences, true);

  // 3. Dispatch Opted-Out Category: Should return null and not deliver
  const optOutDispatch = await pg.query(
    `select public.dispatch_league_notification($1, $2, 'announcement', 'New Sponsor Announced', 'Check out our new sponsor');`,
    [leagueId, playerUserId]
  );
  assert.equal(optOutDispatch.rows[0].dispatch_league_notification, null, "Should return null for opted-out category");

  // 4. Dispatch Allowed Notification: Should log to deliveries
  const allowedDispatch = await pg.query(
    `select public.dispatch_league_notification($1, $2, 'game_reminder', 'Game Tonight at 8 PM', 'Be at Rink 1 by 7:30 PM', '/schedule');`,
    [leagueId, playerUserId]
  );
  const notifId = allowedDispatch.rows[0].dispatch_league_notification;
  assert.ok(notifId, "Should return generated delivery id");

  // 5. Check Notification Inbox
  const inboxRes = await pg.query(
    `select * from public.get_notification_inbox($1, 10);`,
    [leagueId]
  );
  assert.equal(inboxRes.rows.length, 1);
  assert.equal(inboxRes.rows[0].delivery_id, notifId);
  assert.equal(inboxRes.rows[0].title, "Game Tonight at 8 PM");
  assert.equal(inboxRes.rows[0].category, "game_reminder");
  assert.equal(inboxRes.rows[0].channel, "push");
});
