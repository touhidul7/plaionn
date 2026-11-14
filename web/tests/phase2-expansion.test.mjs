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

test("Phase 2 Expansion: Historical Import, Jersey Orders, and Retention CRM", async () => {
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
    "202611160017_historical_season_import.sql",
    "202611160018_merchandise_and_jersey_orders.sql",
    "202611160019_crm_and_retention_analytics.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "30000000-0000-0000-0000-000000000001";
  const commUserId = "30000000-0000-0000-0000-000000000002";
  const season1Id = "30000000-0000-0000-0000-000000000003";
  const season2Id = "30000000-0000-0000-0000-000000000004";
  const div1Id = "30000000-0000-0000-0000-000000000005";
  const div2Id = "30000000-0000-0000-0000-000000000006";
  const team1Id = "30000000-0000-0000-0000-000000000007";
  const team2Id = "30000000-0000-0000-0000-000000000008";
  const entry1Id = "30000000-0000-0000-0000-000000000009";
  const entry2Id = "30000000-0000-0000-0000-00000000000a";
  const captainUserId = "30000000-0000-0000-0000-00000000000b";

  const player1Id = "30000000-0000-0000-0000-000000000010"; // Wayne Gretzky
  const player2Id = "30000000-0000-0000-0000-000000000011"; // Patrick Roy

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com'),
      ('${captainUserId}', 'captain@plaionn.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'PLAIONN Premier League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values
      ('${season1Id}', '${leagueId}', 'Winter 2025'),
      ('${season2Id}', '${leagueId}', 'Summer 2025');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${div1Id}', '${leagueId}', '${season1Id}', 'Division A'),
      ('${div2Id}', '${leagueId}', '${season2Id}', 'Division A');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Oilers'),
      ('${team2Id}', '${leagueId}', 'Canadiens');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${div1Id}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${div2Id}', '${team1Id}');

    insert into public.players (id, display_name) values
      ('${player1Id}', 'Wayne Gretzky'),
      ('${player2Id}', 'Patrick Roy');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${player1Id}'),
      ('${leagueId}', '${player2Id}');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${captainUserId}', 'captain');

    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entry1Id}', '${player1Id}', 99, 'C', 'active'),
      ('${leagueId}', '${entry2Id}', '${player1Id}', 99, 'C', 'active');
  `);

  // ============================================================================
  // Test 1: Historical Season Import with Identity Matching
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const importPayload = {
    season_name: "Winter 2023-24 Historical",
    year_label: "2023-2024",
    champion_team: "Oilers",
    runner_up_team: "Canadiens",
    notes: "Archived inaugural season",
    auto_match_players: true,
    standings: [
      { division_name: "Division A", team_name: "Oilers", rank: 1, gp: 20, w: 16, l: 3, otl: 1, pts: 33, gf: 88, ga: 45, pim: 120 },
      { division_name: "Division A", team_name: "Canadiens", rank: 2, gp: 20, w: 12, l: 7, otl: 1, pts: 25, gf: 60, ga: 52, pim: 98 }
    ],
    skaters: [
      { player_name: "Wayne Gretzky", team_name: "Oilers", position: "C", gp: 20, g: 35, a: 45, pts: 80, pim: 14 },
      { player_name: "Mark Messier", team_name: "Oilers", position: "C", gp: 20, g: 22, a: 30, pts: 52, pim: 40 }
    ],
    goalies: [
      { player_name: "Patrick Roy", team_name: "Canadiens", gp: 18, w: 11, l: 6, otl: 1, shots: 520, sv: 478, ga: 42, so: 3 }
    ]
  };

  const importRes = await pg.query(
    `select public.import_historical_season($1, $2::jsonb) as res`,
    [leagueId, JSON.stringify(importPayload)]
  );

  const importResult = importRes.rows[0].res;
  assert.equal(importResult.standings_imported, 2);
  assert.equal(importResult.skaters_imported, 2);
  assert.equal(importResult.goalies_imported, 1);
  assert.equal(importResult.matched_players, 2); // Wayne Gretzky and Patrick Roy auto-matched

  // Verify Player Career Summary merges historical stats
  const careerRes = await pg.query(
    `select public.get_player_career_summary($1) as career`,
    [player1Id]
  );
  const career = careerRes.rows[0].career;
  assert.equal(career.display_name, "Wayne Gretzky");
  assert.equal(career.skater.points, 80);
  assert.equal(career.skater.goals, 35);
  assert.equal(career.skater.historical_gp, 20);

  // ============================================================================
  // Test 2: Jersey Sizing & Team Merchandise Orders
  // ============================================================================
  // 1. Commissioner adds merchandise product
  const prodId = "30000000-0000-0000-0000-000000000020";
  await pg.exec(`
    insert into public.merchandise_products (id, league_id, sku, name, item_type, unit_price_cents) values
      ('${prodId}', '${leagueId}', 'JERSEY-PRO', 'Pro Sublimated Game Jersey', 'jersey', 8500);
  `);

  // 2. Captain customizes jersey colors & places order
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${captainUserId}', false);
  `);

  const styleRes = await pg.query(
    `select * from public.save_team_jersey_style($1, $2, $3, $4, $5)`,
    [entry1Id, "#00205B", "#FF4C00", "#FFFFFF", "traditional"]
  );
  assert.equal(styleRes.rows[0].primary_color, "#00205B");

  const orderItems = [
    {
      product_id: prodId,
      player_id: player1Id,
      recipient_name: "Wayne Gretzky",
      size: "XL",
      jersey_number: 99,
      custom_nameplate: "GRETZKY",
      quantity: 1
    },
    {
      product_id: prodId,
      player_id: player2Id,
      recipient_name: "Patrick Roy",
      size: "Goalie Cut",
      jersey_number: 33,
      custom_nameplate: "ROY",
      quantity: 1
    }
  ];

  const orderRes = await pg.query(
    `select * from public.create_or_update_team_order($1, $2::jsonb, $3)`,
    [entry1Id, JSON.stringify(orderItems), "Team home jersey set for opening week"]
  );
  const order = orderRes.rows[0];
  assert.equal(order.order_status, "draft");
  assert.equal(order.total_price_cents, 17000); // 8500 * 2 = $170.00

  // Submit order
  const submitRes = await pg.query(
    `select * from public.submit_team_merchandise_order($1)`,
    [order.id]
  );
  assert.equal(submitRes.rows[0].order_status, "submitted");

  // Commissioner advances order to in_production and paid
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);
  const statusUpdate = await pg.query(
    `select * from public.update_merchandise_order_status($1, $2, $3)`,
    [order.id, "in_production", "paid"]
  );
  assert.equal(statusUpdate.rows[0].order_status, "in_production");
  assert.equal(statusUpdate.rows[0].payment_status, "paid");

  // ============================================================================
  // Test 3: League Support CRM Waitlist & Retention Analytics
  // ============================================================================
  // Public user submits waitlist application
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const waitlistRes = await pg.query(
    `select * from public.join_division_waitlist($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      leagueId,
      "individual_player",
      "Connor McDavid",
      "mcdavid@plaionn.com",
      div1Id,
      "555-0199",
      "Competitive",
      ["C", "LW"]
    ]
  );
  const waitlistEntry = waitlistRes.rows[0];
  assert.equal(waitlistEntry.applicant_name, "Connor McDavid");
  assert.equal(waitlistEntry.status, "pending");

  // Commissioner offers spot
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);
  const offerRes = await pg.query(
    `select * from public.manage_waitlist_status($1, $2, $3)`,
    [waitlistEntry.id, "offered", "Spot opened up in Division A"]
  );
  assert.equal(offerRes.rows[0].status, "offered");

  // Retention Analytics check
  const retentionRes = await pg.query(
    `select public.get_league_retention_analytics($1, $2, $3) as r`,
    [leagueId, season1Id, season2Id]
  );
  const ret = retentionRes.rows[0].r;
  assert.equal(ret.base_season_players, 1); // Gretzky in season1
  assert.equal(ret.returning_players, 1);   // Gretzky also in season2
  assert.equal(ret.retention_rate_pct, 100.0);
  assert.equal(ret.churned_players_count, 0);

  console.log("All Phase 2 expansion tests passed successfully!");
});
