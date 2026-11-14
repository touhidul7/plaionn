import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration(pg, filename) {
  const filePath = path.join(__dirname, "../supabase/migrations", filename);
  const sql = await fs.readFile(filePath, "utf8");
  await pg.exec(sql);
}

test("Projection Rebuilds: Standings, Tiebreakers, and Corrections Reproducibility", async () => {
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
    "202611160005_player_and_goalie_stats.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "b0000000-0000-0000-0000-000000000001";
  const commUserId = "b0000000-0000-0000-0000-000000000002";
  const timekeeperId = "b0000000-0000-0000-0000-00000000000c";
  const seasonId = "b0000000-0000-0000-0000-000000000003";
  const divId = "b0000000-0000-0000-0000-000000000004";
  const team1Id = "b0000000-0000-0000-0000-000000000005";
  const entry1Id = "b0000000-0000-0000-0000-000000000006";
  const team2Id = "b0000000-0000-0000-0000-000000000007";
  const entry2Id = "b0000000-0000-0000-0000-000000000008";
  const venueId = "b0000000-0000-0000-0000-000000000009";
  const rinkId = "b0000000-0000-0000-0000-00000000000a";
  const game1Id = "b0000000-0000-0000-0000-00000000000b";
  const player1Id = "b0000000-0000-0000-0000-00000000000d";
  const player2Id = "b0000000-0000-0000-0000-00000000000e";
  const goal1Id = "b0000000-0000-0000-0000-00000000000f";
  const goal2Id = "b0000000-0000-0000-0000-000000000010";
  const goal3Id = "b0000000-0000-0000-0000-000000000011";

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'comm@example.com'),
      ('${timekeeperId}', 'timekeeper@example.com');

    insert into public.leagues (id, name) values ('${leagueId}', 'Projection Test League');
    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner'),
      ('${leagueId}', '${timekeeperId}', 'timekeeper');

    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', '2026 Winter');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Gold Division');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Solar Bears'),
      ('${team2Id}', '${leagueId}', 'Lunar Wolves');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.players (id, display_name) values
      ('${player1Id}', 'Alex Ovechkin'),
      ('${player2Id}', 'Connor McDavid');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${player1Id}'),
      ('${leagueId}', '${player2Id}');

    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entry1Id}', '${player1Id}', 8, 'LW', 'active'),
      ('${leagueId}', '${entry2Id}', '${player2Id}', 97, 'C', 'active');

    insert into public.venues (id, league_id, name, address, time_zone) values ('${venueId}', '${leagueId}', 'Main Ice Complex', '100 Ice Ave', 'America/New_York');
    insert into public.rinks (id, league_id, venue_id, name) values ('${rinkId}', '${leagueId}', '${venueId}', 'Sheet A');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${game1Id}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now() - interval '2 hours', now() - interval '1 hour', 'scheduled');

    insert into public.game_officials (game_id, league_id, slot, user_id, role) values
      ('${game1Id}', '${leagueId}', 'timekeeper', '${timekeeperId}', 'timekeeper');

    -- Insert game events: 2 goals for Bears (entry1), 1 goal for Wolves (entry2)
    insert into public.game_events (id, game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, recorded_by) values
      ('${goal1Id}', '${game1Id}', '${leagueId}', gen_random_uuid(), 'goal', '${entry1Id}', 1, 600, '${player1Id}', '${timekeeperId}'),
      ('${goal2Id}', '${game1Id}', '${leagueId}', gen_random_uuid(), 'goal', '${entry1Id}', 2, 300, '${player1Id}', '${timekeeperId}'),
      ('${goal3Id}', '${game1Id}', '${leagueId}', gen_random_uuid(), 'goal', '${entry2Id}', 3, 100, '${player2Id}', '${timekeeperId}');
  `);

  // 1. Submit initial game result as timekeeper
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${timekeeperId}', false);
  `);

  await pg.query(`
    select public.submit_game_result('${game1Id}', 'regulation', 'Official score submitted');
  `);

  // 2. Review and approve as commissioner (independent review)
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  await pg.query(`
    select public.review_game_result('${game1Id}', true, 'Official scoresheet verified');
  `);

  // 3. Query standings and verify initial projection
  const initialStandings = await pg.query(`
    select * from public.get_season_standings('${seasonId}');
  `);

  assert.equal(initialStandings.rows.length, 2);
  const bearsInitial = initialStandings.rows.find((r) => r.team_entry_id === entry1Id);
  const wolvesInitial = initialStandings.rows.find((r) => r.team_entry_id === entry2Id);

  assert.equal(Number(bearsInitial.points), 2);
  assert.equal(Number(bearsInitial.wins), 1);
  assert.equal(Number(bearsInitial.goals_for), 2);
  assert.equal(Number(bearsInitial.goals_against), 1);
  assert.equal(Number(bearsInitial.goal_difference), 1);

  assert.equal(Number(wolvesInitial.points), 0);
  assert.equal(Number(wolvesInitial.losses), 1);
  assert.equal(Number(wolvesInitial.goals_for), 1);
  assert.equal(Number(wolvesInitial.goals_against), 2);
  assert.equal(Number(wolvesInitial.goal_difference), -1);

  // 4. Score correction workflow: Reopen game result to fix a scoresheet discrepancy
  await pg.query(`
    select public.reopen_game_result('${game1Id}', 'Scoresheet audit correction: Wolves goal was disallowed for high-sticking');
  `);

  // While reopened, standings should not count unapproved games
  const duringReopenStandings = await pg.query(`
    select * from public.get_season_standings('${seasonId}');
  `);
  const bearsDuringReopen = duringReopenStandings.rows.find((r) => r.team_entry_id === entry1Id);
  assert.equal(Number(bearsDuringReopen.points), 0, "Unapproved games must not project onto official standings");

  // Void the wolves goal using the official void_game_event RPC
  await pg.query(`
    select public.void_game_event('${goal3Id}', 'High-sticking disallowance confirmed on video review');
  `);

  // Resubmit corrected game
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${timekeeperId}', false);
  `);

  await pg.query(`
    select public.submit_game_result('${game1Id}', 'regulation', 'Corrected score without disallowed goal');
  `);

  // Re-approve corrected game as commissioner
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  await pg.query(`
    select public.review_game_result('${game1Id}', true, 'Audited scoresheet re-approved');
  `);

  // 5. Verify rebuilt projections reproduce the corrected results deterministically
  const correctedStandings = await pg.query(`
    select * from public.get_season_standings('${seasonId}');
  `);
  const bearsCorrected = correctedStandings.rows.find((r) => r.team_entry_id === entry1Id);
  const wolvesCorrected = correctedStandings.rows.find((r) => r.team_entry_id === entry2Id);

  assert.equal(Number(bearsCorrected.points), 2);
  assert.equal(Number(bearsCorrected.goals_for), 2);
  assert.equal(Number(bearsCorrected.goals_against), 0);
  assert.equal(Number(bearsCorrected.goal_difference), 2);

  assert.equal(Number(wolvesCorrected.goals_for), 0);
  assert.equal(Number(wolvesCorrected.goals_against), 2);
  assert.equal(Number(wolvesCorrected.goal_difference), -2);
});
