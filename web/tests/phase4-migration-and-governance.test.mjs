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

test("Phase 4: Automated League Migration and Franchise Governance", async () => {
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
    "202611160029_league_migration_wizard.sql",
    "202611160030_franchise_governance_and_delegation.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "90000000-0000-0000-0000-000000000001";
  const commUserId = "90000000-0000-0000-0000-000000000002";
  const managerUserId = "90000000-0000-0000-0000-000000000003";
  const seasonId = "90000000-0000-0000-0000-000000000004";

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com'),
      ('${managerUserId}', 'manager@arena.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'Rocky Mountain Hockey Association');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', 'Inaugural Season 2026');
  `);

  // ============================================================================
  // Test 1: Automated Legacy League Migration
  // ============================================================================
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const divisionsBatch = [
    { name: "Competitive A" },
    { name: "Intermediate B" }
  ];

  const teamsBatch = [
    { name: "Golden Eagles", division_name: "Competitive A" },
    { name: "Silver Wolves", division_name: "Intermediate B" }
  ];

  const playersBatch = [
    { name: "Sidney Crosby", team_name: "Golden Eagles", jersey_number: 87, position: "C" },
    { name: "Evgeni Malkin", team_name: "Golden Eagles", jersey_number: 71, position: "C" },
    { name: "Kris Letang", team_name: "Golden Eagles", jersey_number: 58, position: "D" },
    { name: "Marc-Andre Fleury", team_name: "Silver Wolves", jersey_number: 29, position: "G" }
  ];

  const migRes = await pg.query(
    `select * from public.execute_league_migration($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
    [
      leagueId,
      seasonId,
      "teamsnap",
      JSON.stringify(divisionsBatch),
      JSON.stringify(teamsBatch),
      JSON.stringify(playersBatch)
    ]
  );

  const job = migRes.rows[0];
  assert.equal(job.status, "completed");
  assert.equal(job.imported_divisions, 2);
  assert.equal(job.imported_teams, 2);
  assert.equal(job.imported_players, 4);

  // ============================================================================
  // Test 2: Franchise Governance & Delegated Permissions
  // ============================================================================
  const govRes = await pg.query(
    `select * from public.assign_governance_role($1, $2, $3, $4, $5, $6, $7)`,
    [
      leagueId,
      managerUserId,
      "facility_director",
      false, // can_manage_finances
      true,  // can_manage_schedules
      true,  // can_manage_rosters
      false  // can_transfer_ownership
    ]
  );
  const gov = govRes.rows[0];
  assert.equal(gov.governance_model, "facility_director");
  assert.equal(gov.can_manage_finances, false);
  assert.equal(gov.can_manage_schedules, true);

  // Fetch governance team
  const teamRes = await pg.query(
    `select public.get_league_governance_team($1) as team`,
    [leagueId]
  );
  const team = teamRes.rows[0].team;
  assert.equal(team.governance_roles.length, 1);
  assert.equal(team.governance_roles[0].email, "manager@arena.com");

  console.log("Phase 4 migration and franchise governance tests passed successfully!");
});
