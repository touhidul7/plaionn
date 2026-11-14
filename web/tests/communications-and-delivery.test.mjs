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

test("League Communications: Multi-Channel Broadcast and Audited Delivery Ledger", async () => {
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
    "202611130001_game_results_standings.sql",
    "202611160001_onboarding_and_demo_access.sql",
    "202611160016_notifications_and_sms.sql",
    "202611160034_league_communications_and_delivery_logs.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "70000000-0000-0000-0000-000000000001";
  const commUserId = "70000000-0000-0000-0000-000000000002";
  const player1UserId = "70000000-0000-0000-0000-000000000003";
  const player2UserId = "70000000-0000-0000-0000-000000000004";
  const seasonId = "70000000-0000-0000-0000-000000000005";
  const divId = "70000000-0000-0000-0000-000000000006";
  const teamId = "70000000-0000-0000-0000-000000000007";
  const entryId = "70000000-0000-0000-0000-000000000008";
  const p1Id = "70000000-0000-0000-0000-000000000009";
  const p2Id = "70000000-0000-0000-0000-00000000000a";

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com'),
      ('${player1UserId}', 'smsplayer@plaionn.com'),
      ('${player2UserId}', 'quietplayer@plaionn.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'Atlantic Premier League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner'),
      ('${leagueId}', '${player1UserId}', 'player'),
      ('${leagueId}', '${player2UserId}', 'player');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', '2026 Winter Cup');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${divId}', '${leagueId}', '${seasonId}', 'Gold Division');

    insert into public.teams (id, league_id, name) values
      ('${teamId}', '${leagueId}', 'Blizzards');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entryId}', '${leagueId}', '${divId}', '${teamId}');

    insert into public.players (id, display_name, owner_user_id) values
      ('${p1Id}', 'Wayne Gretzky', '${player1UserId}'),
      ('${p2Id}', 'Mario Lemieux', '${player2UserId}');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${p1Id}'),
      ('${leagueId}', '${p2Id}');

    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entryId}', '${p1Id}', 99, 'C', 'active'),
      ('${leagueId}', '${entryId}', '${p2Id}', 66, 'C', 'active');
  `);

  // Configure Preferences: Player 1 has SMS enabled
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${player1UserId}', false);
  `);
  await pg.query(`
    select public.save_notification_preferences(
      '${leagueId}',
      '+14165551234',
      true,  -- sms
      false, -- push
      true,  -- email
      true,  -- reminders
      true,  -- sched
      true,  -- spares
      true,  -- announcements
      true,  -- discipline
      false, -- quiet hours disabled
      '22:00',
      '08:00',
      'America/Toronto'
    );
  `);

  // Configure Preferences: Player 2 has Quiet Hours covering 00:00 to 23:59 (always suppressed)
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${player2UserId}', false);
  `);
  await pg.query(`
    select public.save_notification_preferences(
      '${leagueId}',
      null,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,  -- quiet hours enabled
      '00:00',
      '23:59',
      'America/Toronto'
    );
  `);

  // Commissioner broadcasts league announcement
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const broadcastRes = await pg.query(`
    select public.broadcast_league_notification(
      '${leagueId}',
      'all_league',
      null,
      'announcement',
      'Welcome to the 2026 Winter Cup!',
      'All teams please review the revised schedule on the portal.',
      '/schedule'
    ) as count;
  `);

  assert.ok(broadcastRes.rows[0].count >= 2, "Dispatched broadcast to league members");

  // Fetch Delivery Logs
  const logsRes = await pg.query(`
    select * from public.get_league_delivery_logs('${leagueId}', 20);
  `);

  assert.ok(logsRes.rows.length >= 2, "Delivery logs populated");

  const player1Log = logsRes.rows.find((l) => l.recipient_user_id === player1UserId);
  assert.ok(player1Log, "Found Player 1 delivery log");
  assert.equal(player1Log.channel, "sms");
  assert.equal(player1Log.status, "delivered");

  const player2Log = logsRes.rows.find((l) => l.recipient_user_id === player2UserId);
  assert.ok(player2Log, "Found Player 2 delivery log");
  assert.equal(player2Log.status, "suppressed_quiet_hours");
});
