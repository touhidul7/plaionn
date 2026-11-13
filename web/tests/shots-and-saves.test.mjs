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

test("shots, saves, goalie stints, and boxscore summary", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);

  // Apply prerequisite migrations
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
    "202611160012_shots_saves_and_goalie_tracking.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  // Setup test league, season, teams, game, players
  const leagueId = "10000000-0000-0000-0000-000000000001";
  const seasonId = "10000000-0000-0000-0000-000000000002";
  const divisionId = "10000000-0000-0000-0000-000000000003";
  const team1Id = "10000000-0000-0000-0000-000000000011";
  const team2Id = "10000000-0000-0000-0000-000000000012";
  const entry1Id = "10000000-0000-0000-0000-000000000021";
  const entry2Id = "10000000-0000-0000-0000-000000000022";
  const gameId = "10000000-0000-0000-0000-000000000031";
  const venueId = "10000000-0000-0000-0000-000000000004";
  const rinkId = "10000000-0000-0000-0000-000000000005";
  const commUserId = "20000000-0000-0000-0000-000000000001";
  const goalie1Id = "30000000-0000-0000-0000-000000000001";
  const goalie2Id = "30000000-0000-0000-0000-000000000002";

  await pg.exec(`
    insert into auth.users (id, email) values ('${commUserId}', 'comm@test.com');
    insert into public.leagues (id, name) values ('${leagueId}', 'Shots Test League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${commUserId}', 'commissioner');
    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', 'Season 1');
    insert into public.divisions (id, league_id, season_id, name) values ('${divisionId}', '${leagueId}', '${seasonId}', 'Div A');
    insert into public.venues (id, league_id, name, time_zone) values ('${venueId}', '${leagueId}', 'Main Arena', 'America/Toronto');
    insert into public.rinks (id, league_id, venue_id, name) values ('${rinkId}', '${leagueId}', '${venueId}', 'Rink 1');
    insert into public.teams (id, league_id, name) values ('${team1Id}', '${leagueId}', 'Home Bruins');
    insert into public.teams (id, league_id, name) values ('${team2Id}', '${leagueId}', 'Away Rangers');
    insert into public.team_entries (id, league_id, division_id, team_id) values ('${entry1Id}', '${leagueId}', '${divisionId}', '${team1Id}');
    insert into public.team_entries (id, league_id, division_id, team_id) values ('${entry2Id}', '${leagueId}', '${divisionId}', '${team2Id}');
    
    insert into public.players (id, display_name) values ('${goalie1Id}', 'Henrik Wall');
    insert into public.players (id, display_name) values ('${goalie2Id}', 'Tuukka Brick');
    insert into public.league_players (league_id, player_id) values ('${leagueId}', '${goalie1Id}'), ('${leagueId}', '${goalie2Id}');
    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status)
    values
      ('${leagueId}', '${entry1Id}', '${goalie1Id}', 30, 'G', 'active'),
      ('${leagueId}', '${entry2Id}', '${goalie2Id}', 40, 'G', 'active');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status)
    values ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now(), now() + interval '1 hour', 'scheduled');
  `);

  // Act as commissioner
  await pg.exec(`set request.jwt.claim.sub = '${commUserId}';`);

  // 1. Record period shots for Home Bruins: P1=12, P2=14, P3=8
  await pg.query(`select public.record_period_shots('${gameId}', '${entry1Id}', 1, 12);`);
  await pg.query(`select public.record_period_shots('${gameId}', '${entry1Id}', 2, 14);`);
  await pg.query(`select public.record_period_shots('${gameId}', '${entry1Id}', 3, 8);`);

  // 2. Record period shots for Away Rangers: P1=9, P2=11, P3=10
  await pg.query(`select public.record_period_shots('${gameId}', '${entry2Id}', 1, 9);`);
  await pg.query(`select public.record_period_shots('${gameId}', '${entry2Id}', 2, 11);`);
  await pg.query(`select public.record_period_shots('${gameId}', '${entry2Id}', 3, 10);`);

  // 3. Update P1 shots (idempotent upsert test)
  await pg.query(`select public.record_period_shots('${gameId}', '${entry1Id}', 1, 15);`);

  // 4. Record goalie stint for Henrik Wall (Home): 30 shots faced, 2 goals allowed, Win ('W')
  await pg.query(`
    select public.record_goalie_stint(
      '${gameId}',
      '${entry1Id}',
      '${goalie1Id}',
      1,
      1200,
      3,
      0,
      false,
      30,
      2,
      'W'
    );
  `);

  // 5. Record goalie stint for Tuukka Brick (Away): 37 shots faced, 4 goals allowed, Loss ('L')
  await pg.query(`
    select public.record_goalie_stint(
      '${gameId}',
      '${entry2Id}',
      '${goalie2Id}',
      1,
      1200,
      3,
      0,
      false,
      37,
      4,
      'L'
    );
  `);

  // 6. Query boxscore summary via RPC
  const summaryRes = await pg.query(`select public.get_game_shots_summary('${gameId}') as summary;`);
  const summary = summaryRes.rows[0].summary;

  assert.equal(summary.game_id, gameId);
  assert.equal(summary.home_name, "Home Bruins");
  assert.equal(summary.away_name, "Away Rangers");

  // Verify period shots breakdown
  const homeShots = summary.period_shots.find((s) => s.team_entry_id === entry1Id);
  const awayShots = summary.period_shots.find((s) => s.team_entry_id === entry2Id);

  assert.equal(homeShots.p1, 15); // updated from 12 to 15
  assert.equal(homeShots.p2, 14);
  assert.equal(homeShots.p3, 8);
  assert.equal(homeShots.total, 37);

  assert.equal(awayShots.p1, 9);
  assert.equal(awayShots.p2, 11);
  assert.equal(awayShots.p3, 10);
  assert.equal(awayShots.total, 30);

  // Verify goalie metrics: Saves = Shots - Goals, Save % calculation
  const hGoalie = summary.goalies.find((g) => g.player_id === goalie1Id);
  assert.equal(hGoalie.player_name, "Henrik Wall");
  assert.equal(hGoalie.shots_against, 30);
  assert.equal(hGoalie.goals_against, 2);
  assert.equal(hGoalie.saves, 28);
  assert.equal(hGoalie.save_percentage, 93.3);
  assert.equal(hGoalie.decision, "W");

  const aGoalie = summary.goalies.find((g) => g.player_id === goalie2Id);
  assert.equal(aGoalie.player_name, "Tuukka Brick");
  assert.equal(aGoalie.shots_against, 37);
  assert.equal(aGoalie.goals_against, 4);
  assert.equal(aGoalie.saves, 33);
  assert.equal(aGoalie.save_percentage, 89.2);
  assert.equal(aGoalie.decision, "L");

  // 7. Validation: Rejects invalid shot bounds or goals > shots
  await assert.rejects(
    async () => {
      await pg.query(`select public.record_period_shots('${gameId}', '${entry1Id}', 1, -5);`);
    },
    /Shot count must be between 0 and 150/
  );

  await assert.rejects(
    async () => {
      await pg.query(`
        select public.record_goalie_stint(
          '${gameId}',
          '${entry1Id}',
          '${goalie1Id}',
          1, 1200, 3, 0, false, 10, 15, 'L'
        );
      `);
    },
    /Goals allowed cannot exceed shots faced/
  );
});
