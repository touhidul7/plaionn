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

test("officials certifications, fee rate cards, game payroll calculations and payouts", async () => {
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
    "202611160015_officials_payroll_and_certifications.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "10000000-0000-0000-0000-000000000001";
  const seasonId = "10000000-0000-0000-0000-000000000002";
  const divId = "10000000-0000-0000-0000-000000000003";
  const team1Id = "10000000-0000-0000-0000-000000000004";
  const team2Id = "10000000-0000-0000-0000-000000000005";
  const entry1Id = "10000000-0000-0000-0000-000000000006";
  const entry2Id = "10000000-0000-0000-0000-000000000007";
  const venueId = "10000000-0000-0000-0000-000000000008";
  const rinkId = "10000000-0000-0000-0000-000000000009";
  const gameId = "10000000-0000-0000-0000-00000000000a";

  const commUserId = "20000000-0000-0000-0000-000000000001";
  const refUserId = "20000000-0000-0000-0000-000000000002";
  const timekeeperUserId = "20000000-0000-0000-0000-000000000003";

  // Seed base entities
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'comm@test.com'),
      ('${refUserId}', 'ref@test.com'),
      ('${timekeeperUserId}', 'tk@test.com');

    insert into public.leagues (id, name) values ('${leagueId}', 'Test League');
    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner'),
      ('${leagueId}', '${refUserId}', 'referee'),
      ('${leagueId}', '${timekeeperUserId}', 'timekeeper');

    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', '2026 Season');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Div A');
    insert into public.teams (id, league_id, name) values ('${team1Id}', '${leagueId}', 'Hawks'), ('${team2Id}', '${leagueId}', 'Eagles');
    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values ('${venueId}', '${leagueId}', 'Ice Palace', '100 Ice Way', 'America/Toronto');
    insert into public.rinks (id, league_id, venue_id, name) values ('${rinkId}', '${leagueId}', '${venueId}', 'Main Rink');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now() - interval '2 hours', now() - interval '1 hour', 'scheduled');

    -- Assign referee and timekeeper to the game
    insert into public.game_officials (game_id, league_id, slot, user_id, role) values
      ('${gameId}', '${leagueId}', 'referee_1', '${refUserId}', 'referee'),
      ('${gameId}', '${leagueId}', 'timekeeper', '${timekeeperUserId}', 'timekeeper');
  `);

  // Switch to authenticated commissioner
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  // 1. Configure Official Profiles and Rate Cards
  await pg.query(
    `select public.upsert_official_profile($1, $2, $3, $4, $5, $6, $7, true);`,
    [leagueId, refUserId, "Wes McCauley", "Level 4", "2027-12-31", 5000, 3000] // $50/game
  );

  await pg.query(
    `select public.upsert_official_profile($1, $2, $3, $4, $5, $6, $7, true);`,
    [leagueId, timekeeperUserId, "Dan O'Halloran", "Timekeeper Cert", "2027-12-31", 4500, 3500] // $35/game
  );

  // 2. Generate Game Payroll Entry
  const genCount = await pg.query(
    `select public.generate_game_payroll_entry($1) as count;`,
    [gameId]
  );
  assert.equal(Number(genCount.rows[0].count), 2, "Should generate payroll entries for ref and timekeeper");

  // 3. Inspect Payroll Summary
  const summaryRes = await pg.query(
    `select * from public.get_officials_payroll_summary($1);`,
    [leagueId]
  );
  assert.equal(summaryRes.rows.length, 2);

  const refSummary = summaryRes.rows.find((r) => r.user_id === refUserId);
  assert.ok(refSummary);
  assert.equal(refSummary.full_name, "Wes McCauley");
  assert.equal(Number(refSummary.total_games), 1);
  assert.equal(Number(refSummary.referee_games), 1);
  assert.equal(Number(refSummary.total_earned_cents), 5000); // $50
  assert.equal(Number(refSummary.pending_cents), 5000);
  assert.equal(Number(refSummary.paid_cents), 0);

  const tkSummary = summaryRes.rows.find((r) => r.user_id === timekeeperUserId);
  assert.ok(tkSummary);
  assert.equal(tkSummary.full_name, "Dan O'Halloran");
  assert.equal(Number(tkSummary.total_earned_cents), 3500); // $35

  // 4. Mark Ref Payout as Paid
  const paidCount = await pg.query(
    `select public.mark_official_payout($1, $2, $3) as count;`,
    [leagueId, refUserId, "ETRANSFER-REF-10924"]
  );
  assert.equal(Number(paidCount.rows[0].count), 1);

  // Re-verify summary: Ref is now paid
  const updatedSummary = await pg.query(
    `select * from public.get_officials_payroll_summary($1);`,
    [leagueId]
  );
  const refAfter = updatedSummary.rows.find((r) => r.user_id === refUserId);
  assert.equal(Number(refAfter.pending_cents), 0);
  assert.equal(Number(refAfter.paid_cents), 5000);
});
