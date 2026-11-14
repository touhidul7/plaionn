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

test("Phase 4: White-label Branding and SaaS Platform Billing", async () => {
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
    "202611160023_whitelabel_and_branding.sql",
    "202611160024_saas_platform_fees.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "60000000-0000-0000-0000-000000000001";
  const commUserId = "60000000-0000-0000-0000-000000000002";
  const seasonId = "60000000-0000-0000-0000-000000000003";
  const divId = "60000000-0000-0000-0000-000000000004";
  const team1Id = "60000000-0000-0000-0000-000000000005";
  const entry1Id = "60000000-0000-0000-0000-000000000006";

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@wahl.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'Western Adult Hockey League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', '2026 Season');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${divId}', '${leagueId}', '${seasonId}', 'Division 1');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Calgary Stallions');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}');
  `);

  // ============================================================================
  // Test 1: White-label Custom Branding & Domain Routing
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const brandRes = await pg.query(
    `select * from public.update_league_branding($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      leagueId,
      "WAHL Hockey",
      "wahlhockey.ca",
      "#002D62", // Navy
      "#C8102E", // Red
      "#FFB81C", // Gold
      "https://wahlhockey.ca/logo.png",
      "Premier Adult Hockey Circuit",
      "Calgary & Edmonton Premier Divisions"
    ]
  );
  const brand = brandRes.rows[0];
  assert.equal(brand.brand_name, "WAHL Hockey");
  assert.equal(brand.custom_domain, "wahlhockey.ca");

  // Public domain resolution check
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const resolvedRes = await pg.query(
    `select public.resolve_league_by_domain($1) as res`,
    ["wahlhockey.ca"]
  );
  const resolved = resolvedRes.rows[0].res;
  assert.equal(resolved.league_id, leagueId);
  assert.equal(resolved.brand_name, "WAHL Hockey");
  assert.equal(resolved.primary_color, "#002D62");

  // ============================================================================
  // Test 2: SaaS Platform Subscription & Automated Billing Calculation
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  // Subscribe to pro_league plan
  const subRes = await pg.query(
    `select * from public.change_league_subscription($1, $2, $3)`,
    [leagueId, "pro_league", "monthly"]
  );
  assert.equal(subRes.rows[0].status, "active");

  // Calculate billing
  const billRes = await pg.query(
    `select public.get_league_platform_billing($1) as bill`,
    [leagueId]
  );
  const bill = billRes.rows[0].bill;
  assert.equal(bill.plan_code, "pro_league");
  assert.equal(bill.active_team_count, 1);
  // Base 4900 ($49.00) + 1 team * 500 ($5.00) = 5400 cents ($54.00)
  assert.equal(bill.total_cycle_fee_cents, 5400);
  assert.equal(bill.features.video_streaming, true);
  assert.equal(bill.features.custom_domain, true);

  console.log("Phase 4 white-label & SaaS platform billing tests passed successfully!");
});
