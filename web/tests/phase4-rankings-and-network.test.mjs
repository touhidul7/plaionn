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

test("Phase 4: Cross-League Rankings and Executive Network KPIs", async () => {
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
    "202611160025_cross_league_rankings.sql",
    "202611160026_network_hq_and_kpis.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const ownerUserId = "70000000-0000-0000-0000-000000000001";
  const league1Id = "70000000-0000-0000-0000-000000000002";
  const league2Id = "70000000-0000-0000-0000-000000000003";
  const season1Id = "70000000-0000-0000-0000-000000000004";
  const div1Id = "70000000-0000-0000-0000-000000000005";
  const team1Id = "70000000-0000-0000-0000-000000000006";
  const team2Id = "70000000-0000-0000-0000-000000000007";
  const entry1Id = "70000000-0000-0000-0000-000000000008";
  const entry2Id = "70000000-0000-0000-0000-000000000009";

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${ownerUserId}', 'executive@plaionn.com');

    insert into public.leagues (id, name) values
      ('${league1Id}', 'Metro Hockey League'),
      ('${league2Id}', 'Coastal Hockey League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${league1Id}', '${ownerUserId}', 'commissioner'),
      ('${league2Id}', '${ownerUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values
      ('${season1Id}', '${league1Id}', 'Winter 2026');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${div1Id}', '${league1Id}', '${season1Id}', 'Open Div');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${league1Id}', 'Metro Knights'),
      ('${team2Id}', '${league1Id}', 'Metro Blades');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${league1Id}', '${div1Id}', '${team1Id}'),
      ('${entry2Id}', '${league1Id}', '${div1Id}', '${team2Id}');
  `);

  // ============================================================================
  // Test 1: Team Power Rankings & Cross-League Leaderboard
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ownerUserId}', false);
  `);

  const rankRes = await pg.query(
    `select * from public.calculate_league_power_rankings($1)`,
    [league1Id]
  );
  assert.equal(rankRes.rows.length, 2);

  // Check cross-league rankings anonymously
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const netRankRes = await pg.query(
    `select * from public.get_network_cross_league_rankings(null)`
  );
  assert.equal(netRankRes.rows.length, 2);
  assert.equal(netRankRes.rows[0].league_name, "Metro Hockey League");

  // ============================================================================
  // Test 2: Network Organization & Executive KPIs Rollup
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ownerUserId}', false);
  `);

  const orgRes = await pg.query(
    `select * from public.create_network_organization($1)`,
    ["Plaionn National Franchise"]
  );
  const org = orgRes.rows[0];
  assert.equal(org.name, "Plaionn National Franchise");

  // Add both leagues to the network organization
  await pg.query(
    `select public.add_league_to_network($1, $2)`,
    [org.id, league1Id]
  );
  await pg.query(
    `select public.add_league_to_network($1, $2)`,
    [org.id, league2Id]
  );

  // Fetch executive KPIs
  const kpiRes = await pg.query(
    `select public.get_network_executive_kpis($1) as kpis`,
    [org.id]
  );
  const kpis = kpiRes.rows[0].kpis;
  assert.equal(kpis.total_leagues, 2);
  assert.equal(kpis.total_teams, 2);
  assert.equal(kpis.leagues.length, 2);

  console.log("Phase 4 cross-league rankings & network KPI tests passed successfully!");
});
