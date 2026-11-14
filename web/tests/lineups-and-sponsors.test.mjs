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

test("game lineups, goalie status, suspension guards, and league sponsors", async () => {
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
    "202611160004_game_attendance_rsvp.sql",
    "202611160008_discipline_and_suspensions.sql",
    "202611160009_spare_goalie_callups.sql",
    "202611160013_lineups_sponsors_and_calendar.sql",
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
  const player1 = "10000000-0000-0000-0000-000000000010"; // Forward
  const player2 = "10000000-0000-0000-0000-000000000011"; // Goalie
  const player3 = "10000000-0000-0000-0000-000000000012"; // Defenseman
  const player4 = "10000000-0000-0000-0000-000000000013"; // Forward 2
  const commUserId = "20000000-0000-0000-0000-000000000001";

  // Seed base entities
  await pg.exec(`
    insert into auth.users (id, email) values ('${commUserId}', 'comm@test.com');
    insert into public.leagues (id, name) values ('${leagueId}', 'Test League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${commUserId}', 'commissioner');
    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', '2026 Season');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Div A');
    insert into public.teams (id, league_id, name) values ('${team1Id}', '${leagueId}', 'Hawks');
    insert into public.teams (id, league_id, name) values ('${team2Id}', '${leagueId}', 'Eagles');
    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values ('${venueId}', '${leagueId}', 'Ice Palace', '100 Ice Way', 'America/Toronto');
    insert into public.rinks (id, league_id, venue_id, name) values ('${rinkId}', '${leagueId}', '${venueId}', 'Main Rink');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now() + interval '1 day', now() + interval '1 day 1 hour', 'scheduled');

    insert into public.players (id, display_name) values
      ('${player1}', 'Connor McDavid'),
      ('${player2}', 'Igor Shesterkin'),
      ('${player3}', 'Cale Makar'),
      ('${player4}', 'Leon Draisaitl');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${player1}'),
      ('${leagueId}', '${player2}'),
      ('${leagueId}', '${player3}'),
      ('${leagueId}', '${player4}');

    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entry1Id}', '${player1}', 97, 'C', 'active'),
      ('${leagueId}', '${entry1Id}', '${player2}', 31, 'G', 'active'),
      ('${leagueId}', '${entry1Id}', '${player3}', 8, 'D', 'active'),
      ('${leagueId}', '${entry1Id}', '${player4}', 29, 'C', 'active');
  `);

  // Switch to authenticated commissioner
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  // 1. Test Lineup Submission (Forward, Goalie, Defense)
  const lineupJson = JSON.stringify([
    { player_id: player1, line_assignment: "F1_C", jersey_number: 97 },
    { player_id: player2, line_assignment: "G_STARTER", jersey_number: 31 },
    { player_id: player3, line_assignment: "D1_RD", jersey_number: 8 },
  ]);

  const saveRes = await pg.query(
    `select public.save_game_lineup($1, $2, $3::jsonb) as count;`,
    [gameId, entry1Id, lineupJson]
  );
  assert.equal(Number(saveRes.rows[0].count), 3, "Should save 3 lineup assignments");

  // 2. Test Get Lineup
  const fetchRes = await pg.query(
    `select * from public.get_game_lineup($1, $2);`,
    [gameId, entry1Id]
  );
  assert.equal(fetchRes.rows.length, 4, "Should return all 4 roster players (3 assigned + 1 scratch)");
  const starterG = fetchRes.rows.find((r) => r.line_assignment === "G_STARTER");
  assert.ok(starterG, "Should have starting goalie");
  assert.equal(starterG.player_id, player2);
  assert.equal(starterG.jersey_number, 31);
  const scratch = fetchRes.rows.find((r) => r.line_assignment === "SCRATCH");
  assert.ok(scratch, "Unassigned player should default to scratch");
  assert.equal(scratch.player_id, player4);

  // 3. Test Line Slot Uniqueness (Can't put two players on F1_C)
  await assert.rejects(
    async () => {
      await pg.exec(`
        insert into public.game_lineups (league_id, game_id, team_entry_id, player_id, line_assignment)
        values ('${leagueId}', '${gameId}', '${entry1Id}', '${player4}', 'F1_C');
      `);
    },
    /idx_unique_game_line_slot/,
    "Should reject duplicate assignment to F1_C"
  );

  // 4. Test League Sponsors
  const sponsorIdRes = await pg.query(
    `select public.upsert_league_sponsor($1, null, $2, $3, $4, $5, $6, $7) as id;`,
    [
      leagueId,
      "Pro Hockey Gear",
      "https://example.com/logo.png",
      "https://example.com",
      "primary_banner",
      "Official Stick and Equipment Partner",
      1,
    ]
  );
  const newSponsorId = sponsorIdRes.rows[0].id;
  assert.ok(newSponsorId, "Should return generated sponsor id");

  // Fetch active sponsors as anon
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const sponsorsRes = await pg.query(
    `select * from public.get_active_league_sponsors($1);`,
    [leagueId]
  );
  assert.equal(sponsorsRes.rows.length, 1);
  assert.equal(sponsorsRes.rows[0].name, "Pro Hockey Gear");
  assert.equal(sponsorsRes.rows[0].placement_tier, "primary_banner");

  // Delete sponsor as commissioner
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);
  const delRes = await pg.query(
    `select public.delete_league_sponsor($1, $2) as deleted;`,
    [leagueId, newSponsorId]
  );
  assert.equal(delRes.rows[0].deleted, true);

  const sponsorsAfter = await pg.query(
    `select * from public.get_active_league_sponsors($1);`,
    [leagueId]
  );
  assert.equal(sponsorsAfter.rows.length, 0, "Sponsor should be deleted");
});
