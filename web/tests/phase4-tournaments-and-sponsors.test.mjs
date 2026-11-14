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

test("Phase 4: Tournaments, Pools, and Sponsor Analytics", async () => {
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
    "202611160013_lineups_sponsors_and_calendar.sql",
    "202611160021_tournaments_and_cross_league.sql",
    "202611160022_sponsor_campaigns_and_analytics.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "50000000-0000-0000-0000-000000000001";
  const commUserId = "50000000-0000-0000-0000-000000000002";
  const seasonId = "50000000-0000-0000-0000-000000000003";
  const divId = "50000000-0000-0000-0000-000000000004";
  const team1Id = "50000000-0000-0000-0000-000000000005";
  const team2Id = "50000000-0000-0000-0000-000000000006";
  const entry1Id = "50000000-0000-0000-0000-000000000007";
  const entry2Id = "50000000-0000-0000-0000-000000000008";

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'PLAIONN Premier Tournament Circuit');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', '2026 Spring Tour');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${divId}', '${leagueId}', '${seasonId}', 'Open Div');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Blizzards'),
      ('${team2Id}', '${leagueId}', 'Avalanche');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');
  `);

  // ============================================================================
  // Test 1: Tournament & Pool Management
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const tournRes = await pg.query(
    `select * from public.create_tournament($1, $2, $3, $4, $5, $6, $7)`,
    [
      leagueId,
      "Plaionn Cup 2026",
      "pool_to_bracket",
      "2026-06-01",
      "2026-06-03",
      75000,
      16
    ]
  );
  const tourn = tournRes.rows[0];
  assert.equal(tourn.name, "Plaionn Cup 2026");
  assert.equal(tourn.entry_fee_cents, 75000);

  // Setup pools
  const poolsRes = await pg.query(
    `select * from public.setup_tournament_pools($1, $2, $3)`,
    [tourn.id, ["Pool A", "Pool B"], 2]
  );
  assert.equal(poolsRes.rows.length, 2);
  const poolAId = poolsRes.rows[0].id;
  const poolBId = poolsRes.rows[1].id;

  // Assign teams to pools
  await pg.query(
    `select * from public.assign_team_to_pool($1, $2, $3)`,
    [poolAId, entry1Id, 1]
  );
  await pg.query(
    `select * from public.assign_team_to_pool($1, $2, $3)`,
    [poolBId, entry2Id, 1]
  );

  // Fetch overview anonymously
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const overviewRes = await pg.query(
    `select public.get_tournament_overview($1) as overview`,
    [tourn.id]
  );
  const overview = overviewRes.rows[0].overview;
  assert.equal(overview.name, "Plaionn Cup 2026");
  assert.equal(overview.pools.length, 2);
  assert.equal(overview.pools[0].standings.length, 1);
  assert.equal(overview.pools[0].standings[0].team_name, "Blizzards");

  // ============================================================================
  // Test 2: Sponsor Tracking & Campaign Analytics
  // ============================================================================
  const sponsorId = "50000000-0000-0000-0000-000000000020";
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
    insert into public.league_sponsors (id, league_id, name, website_url, placement_tier) values
      ('${sponsorId}', '${leagueId}', 'CCM Hockey', 'https://ccmhockey.com', 'primary_banner');
  `);

  // Anon users interact with sponsor banner
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  // Track 4 impressions
  for (let i = 0; i < 4; i++) {
    await pg.query(
      `select public.track_sponsor_interaction($1, $2)`,
      [sponsorId, "impression"]
    );
  }
  // Track 1 click
  await pg.query(
    `select public.track_sponsor_interaction($1, $2)`,
    [sponsorId, "click"]
  );

  // Commissioner views campaign analytics
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);
  const reportRes = await pg.query(
    `select public.get_sponsor_campaign_report($1) as report`,
    [leagueId]
  );
  const report = reportRes.rows[0].report;
  assert.equal(report.total_impressions, 4);
  assert.equal(report.total_clicks, 1);
  assert.equal(report.overall_ctr_pct, 25.0); // 1 / 4 = 25% CTR
  assert.equal(report.sponsors[0].name, "CCM Hockey");

  console.log("Phase 4 tournaments & sponsor analytics tests passed successfully!");
});
