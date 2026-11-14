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

test("Phase 4: Paid Fan Passes and Multi-sport Adaptability", async () => {
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
    "202611160027_paid_media_and_fan_passes.sql",
    "202611160028_multisport_adaptability.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "80000000-0000-0000-0000-000000000001";
  const commUserId = "80000000-0000-0000-0000-000000000002";
  const fanUserId = "80000000-0000-0000-0000-000000000003";
  const seasonId = "80000000-0000-0000-0000-000000000004";
  const divId = "80000000-0000-0000-0000-000000000005";
  const team1Id = "80000000-0000-0000-0000-000000000006";
  const team2Id = "80000000-0000-0000-0000-000000000007";
  const entry1Id = "80000000-0000-0000-0000-000000000008";
  const entry2Id = "80000000-0000-0000-0000-000000000009";
  const gameId = "80000000-0000-0000-0000-00000000000a";
  const venueId = "80000000-0000-0000-0000-00000000000b";
  const rinkId = "80000000-0000-0000-0000-00000000000c";

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com'),
      ('${fanUserId}', 'parent@gmail.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'Pacific Ball & Ice League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', 'Season 1');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${divId}', '${leagueId}', '${seasonId}', 'Div 1');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Sharks'),
      ('${team2Id}', '${leagueId}', 'Vipers');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values
      ('${venueId}', '${leagueId}', 'Pacific Arena', '100 Ocean Blvd', 'America/Vancouver');

    insert into public.rinks (id, league_id, venue_id, name) values
      ('${rinkId}', '${leagueId}', '${venueId}', 'Main Floor');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now(), now() + interval '1 hour', 'scheduled');
  `);

  // ============================================================================
  // Test 1: Paid Fan Passes & Paywall Enforcement
  // ============================================================================
  // 1. Commissioner activates video paywall
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const paywallRes = await pg.query(
    `select * from public.configure_stream_paywall($1, $2, $3, $4)`,
    [leagueId, true, 999, 4999]
  );
  assert.equal(paywallRes.rows[0].is_paywall_active, true);

  // 2. Unpurchased fan checks access -> denied (false)
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${fanUserId}', false);
  `);
  const checkDenied = await pg.query(
    `select public.verify_fan_stream_access($1, $2) as ok`,
    [gameId, fanUserId]
  );
  assert.equal(checkDenied.rows[0].ok, false);

  // 3. Fan purchases single-game ticket
  const purchaseRes = await pg.query(
    `select * from public.purchase_fan_pass($1, $2, $3, null)`,
    [leagueId, "single_game_ticket", gameId]
  );
  assert.equal(purchaseRes.rows[0].pass_type, "single_game_ticket");
  assert.equal(purchaseRes.rows[0].amount_paid_cents, 999);

  // 4. Access re-check -> granted (true)
  const checkGranted = await pg.query(
    `select public.verify_fan_stream_access($1, $2) as ok`,
    [gameId, fanUserId]
  );
  assert.equal(checkGranted.rows[0].ok, true);

  // 5. Commissioner check -> complimentary (true)
  const checkComm = await pg.query(
    `select public.verify_fan_stream_access($1, $2) as ok`,
    [gameId, commUserId]
  );
  assert.equal(checkComm.rows[0].ok, true);

  // ============================================================================
  // Test 2: Multi-sport Configuration
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  // Configure league as Ball Hockey (2 halves, 25 mins)
  const sportRes = await pg.query(
    `select * from public.update_league_sport_config($1, $2, $3, $4, $5)`,
    [leagueId, "ball_hockey", "2_halves", 25, ["F", "D", "G"]]
  );
  const sport = sportRes.rows[0];
  assert.equal(sport.sport_type, "ball_hockey");
  assert.equal(sport.sport_display_name, "Ball / Dek Hockey");
  assert.equal(sport.period_format, "2_halves");
  assert.equal(sport.period_duration_minutes, 25);

  // Public retrieval check
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const getSport = await pg.query(
    `select * from public.get_league_sport_config($1)`,
    [leagueId]
  );
  assert.equal(getSport.rows[0].sport_display_name, "Ball / Dek Hockey");

  console.log("Phase 4 fan passes & multi-sport adaptability tests passed successfully!");
});
