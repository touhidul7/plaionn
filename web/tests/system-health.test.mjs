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

test("System Health: Automated Ledger Invariant and Operational Integrity Diagnostics", async () => {
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
    "202611160001_onboarding_and_demo_access.sql",
    "202611160002_billing_and_invoices.sql",
    "202611160036_system_health_and_integrity_audit.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "90000000-0000-0000-0000-000000000001";
  const commUserId = "90000000-0000-0000-0000-000000000002";
  const nonCommUserId = "90000000-0000-0000-0000-000000000003";
  const seasonId = "90000000-0000-0000-0000-000000000004";
  const divId = "90000000-0000-0000-0000-000000000005";
  const teamId = "90000000-0000-0000-0000-000000000006";
  const entryId = "90000000-0000-0000-0000-000000000007";
  const team2Id = "90000000-0000-0000-0000-0000000000b1";
  const entry2Id = "90000000-0000-0000-0000-0000000000b2";
  const venueId = "90000000-0000-0000-0000-000000000008";
  const rinkId = "90000000-0000-0000-0000-000000000009";
  const gameId = "90000000-0000-0000-0000-00000000000a";

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'comm@example.com'),
      ('${nonCommUserId}', 'fan@example.com');

    insert into public.leagues (id, name) values ('${leagueId}', 'Diagnostic Test League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', '2026 Spring');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Div 1');

    insert into public.teams (id, league_id, name) values
      ('${teamId}', '${leagueId}', 'Solar Bears'),
      ('${team2Id}', '${leagueId}', 'Lunar Wolves');
    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entryId}', '${leagueId}', '${divId}', '${teamId}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values ('${venueId}', '${leagueId}', 'Main Arena', '123 Rink St', 'America/New_York');
    insert into public.rinks (id, league_id, venue_id, name) values ('${rinkId}', '${leagueId}', '${venueId}', 'Pad 1');

    -- Insert scheduled game
    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entryId}', '${entry2Id}', '${rinkId}', now() + interval '1 day', now() + interval '1 day 1 hour', 'scheduled');

    -- Insert balanced invoice
    insert into public.league_invoices (league_id, season_id, recipient_type, team_entry_id, title, amount_cents, amount_paid_cents, currency, status) values
      ('${leagueId}', '${seasonId}', 'team', '${entryId}', 'Team Registration Fee', 120000, 60000, 'CAD', 'partially_paid');
  `);

  // 1. Non-commissioner cannot run health check
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${nonCommUserId}', false);
  `);

  await assert.rejects(
    async () => {
      await pg.query(`select public.check_league_system_health('${leagueId}');`);
    },
    /Commissioner permissions required/
  );

  // 2. Commissioner runs health check
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const res = await pg.query(`
    select public.check_league_system_health('${leagueId}') as health;
  `);

  const health = res.rows[0].health;
  assert.equal(health.overall_status, "healthy");
  assert.equal(health.ledger_invariants.total_invoices, 1);
  assert.equal(health.ledger_invariants.total_billed_cents, 120000);
  assert.equal(health.ledger_invariants.total_collected_cents, 60000);
  assert.equal(health.ledger_invariants.outstanding_balance_cents, 60000);
  assert.equal(health.ledger_invariants.anomalies_detected, 0);
  assert.equal(health.ledger_invariants.is_balanced, true);
  assert.equal(health.game_sheet_integrity.total_games, 1);
  assert.equal(health.game_sheet_integrity.pending_official_approvals, 0);
});
