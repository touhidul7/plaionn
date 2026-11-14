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

test("game three stars, season awards, and honors ledger", async () => {
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
    "202611160014_awards_and_game_stars.sql",
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
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now() - interval '2 hours', now() - interval '1 hour', 'scheduled');

    insert into public.players (id, display_name) values
      ('${player1}', 'Connor McDavid'),
      ('${player2}', 'Igor Shesterkin'),
      ('${player3}', 'Cale Makar');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${player1}'),
      ('${leagueId}', '${player2}'),
      ('${leagueId}', '${player3}');

    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entry1Id}', '${player1}', 97, 'C', 'active'),
      ('${leagueId}', '${entry1Id}', '${player2}', 31, 'G', 'active'),
      ('${leagueId}', '${entry2Id}', '${player3}', 8, 'D', 'active');
  `);

  // Switch to authenticated commissioner
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  // 1. Test Selection of Three Stars of the Game
  const starsJson = JSON.stringify([
    { star_number: 1, player_id: player1, team_entry_id: entry1Id, headline: "Hat Trick (3 Goals, 1 Assist)" },
    { star_number: 2, player_id: player2, team_entry_id: entry1Id, headline: "34 Saves on 35 Shots (.971 SV%)" },
    { star_number: 3, player_id: player3, team_entry_id: entry2Id, headline: "1 Goal, 2 Blocks, 24 TOI" },
  ]);

  const saveRes = await pg.query(
    `select public.set_game_stars($1, $2::jsonb) as count;`,
    [gameId, starsJson]
  );
  assert.equal(Number(saveRes.rows[0].count), 3, "Should record all three stars");

  // 2. Fetch game stars as anonymous visitor
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const starsRes = await pg.query(
    `select * from public.get_game_stars($1);`,
    [gameId]
  );
  assert.equal(starsRes.rows.length, 3);
  assert.equal(starsRes.rows[0].star_number, 1);
  assert.equal(starsRes.rows[0].display_name, "Connor McDavid");
  assert.equal(starsRes.rows[0].headline, "Hat Trick (3 Goals, 1 Assist)");
  assert.equal(starsRes.rows[1].star_number, 2);
  assert.equal(starsRes.rows[1].display_name, "Igor Shesterkin");
  assert.equal(starsRes.rows[2].star_number, 3);
  assert.equal(starsRes.rows[2].display_name, "Cale Makar");

  // 3. Test Season Awards & Honors
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const mvpRes = await pg.query(
    `select public.assign_season_award($1, $2, $3, $4, $5, $6, $7) as id;`,
    [
      seasonId,
      divId,
      "MVP",
      "Most Valuable Player",
      player1,
      entry1Id,
      "Led division with 28 goals and 45 points in 14 games",
    ]
  );
  assert.ok(mvpRes.rows[0].id, "Should assign MVP award");

  const vezinaRes = await pg.query(
    `select public.assign_season_award($1, $2, $3, $4, $5, $6, $7) as id;`,
    [
      seasonId,
      divId,
      "BEST_GOALTENDER",
      "Top Goaltender Award",
      player2,
      entry1Id,
      "1.45 GAA, .942 SV%, 4 Shutouts",
    ]
  );
  assert.ok(vezinaRes.rows[0].id, "Should assign Goaltender award");

  // Fetch season awards as anonymous fan
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const awardsRes = await pg.query(
    `select * from public.get_season_awards($1, $2);`,
    [seasonId, divId]
  );
  assert.equal(awardsRes.rows.length, 2);
  assert.equal(awardsRes.rows[0].code, "MVP");
  assert.equal(awardsRes.rows[0].display_name, "Connor McDavid");
  assert.equal(awardsRes.rows[1].code, "BEST_GOALTENDER");
  assert.equal(awardsRes.rows[1].display_name, "Igor Shesterkin");
});
