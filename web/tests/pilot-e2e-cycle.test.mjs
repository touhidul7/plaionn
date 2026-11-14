import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("Pilot Operating Cycle: End-to-End Season, Billing, Game Sheet, and Standings Verification", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text
    );
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      bucket_id text not null,
      name text not null,
      primary key(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public, storage to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant select, insert, delete on storage.objects to authenticated;
  `);

  const migrationsDir = path.join(__dirname, "../supabase/migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    await pg.exec(sql);
  }

  // 1. Setup League Identities
  const leagueId = "c0000000-0000-0000-0000-000000000001";
  const commUserId = "c0000000-0000-0000-0000-000000000002";
  const timekeeperId = "c0000000-0000-0000-0000-000000000003";
  const player1UserId = "c0000000-0000-0000-0000-000000000004";
  const player2UserId = "c0000000-0000-0000-0000-000000000005";

  const seasonId = "c0000000-0000-0000-0000-000000000006";
  const divId = "c0000000-0000-0000-0000-000000000007";
  const team1Id = "c0000000-0000-0000-0000-000000000008";
  const entry1Id = "c0000000-0000-0000-0000-000000000009";
  const team2Id = "c0000000-0000-0000-0000-00000000000a";
  const entry2Id = "c0000000-0000-0000-0000-00000000000b";

  const venueId = "c0000000-0000-0000-0000-00000000000c";
  const rinkId = "c0000000-0000-0000-0000-00000000000d";
  const gameId = "c0000000-0000-0000-0000-00000000000e";

  const p1Id = "c0000000-0000-0000-0000-000000000010";
  const p2Id = "c0000000-0000-0000-0000-000000000011";

  const roster1Id = "c0000000-0000-0000-0000-000000000031";
  const roster2Id = "c0000000-0000-0000-0000-000000000032";

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commissioner@plaionn.com'),
      ('${timekeeperId}', 'timekeeper@plaionn.com'),
      ('${player1UserId}', 'captain1@plaionn.com'),
      ('${player2UserId}', 'captain2@plaionn.com');

    insert into public.leagues (id, name) values ('${leagueId}', 'Plaionn Pilot League');
    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner'),
      ('${leagueId}', '${timekeeperId}', 'timekeeper'),
      ('${leagueId}', '${player1UserId}', 'captain'),
      ('${leagueId}', '${player2UserId}', 'captain');

    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', '2026 Pilot Championship');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Premier');

    insert into public.season_settings (
      season_id, league_id, roster_limit, period_count, period_minutes, clock_mode,
      win_points, tie_points, loss_points, overtime_loss_points, billing_model, currency,
      team_fee_cents, player_fee_cents
    ) values (
      '${seasonId}', '${leagueId}', 22, 3, 20, 'stop',
      2, 1, 0, 1, 'team', 'CAD', 120000, 0
    );

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Northline HC'),
      ('${team2Id}', '${leagueId}', 'Harbour Wolves');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.players (id, display_name) values
      ('${p1Id}', 'Connor McDavid'),
      ('${p2Id}', 'Auston Matthews');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${p1Id}'),
      ('${leagueId}', '${p2Id}');

    insert into public.roster_memberships (id, league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${roster1Id}', '${leagueId}', '${entry1Id}', '${p1Id}', 97, 'C', 'active'),
      ('${roster2Id}', '${leagueId}', '${entry2Id}', '${p2Id}', 34, 'C', 'active');

    insert into public.venues (id, league_id, name, address, time_zone) values
      ('${venueId}', '${leagueId}', 'Pilot Ice Center', '100 Rink Way', 'America/Toronto');

    insert into public.rinks (id, league_id, venue_id, name) values
      ('${rinkId}', '${leagueId}', '${venueId}', 'Main Arena');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now() - interval '2 hours', now() - interval '1 hour', 'scheduled');

    insert into public.game_officials (game_id, league_id, slot, user_id, role) values
      ('${gameId}', '${leagueId}', 'timekeeper', '${timekeeperId}', 'timekeeper');
  `);

  // 2. Financial Ledger & Invoicing Operation
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  // Commissioner grants tournament eligibility overrides for rostered players
  await pg.query(`select public.grant_player_eligibility_override('${roster1Id}', 'Pilot tournament approved clearance');`);
  await pg.query(`select public.grant_player_eligibility_override('${roster2Id}', 'Pilot tournament approved clearance');`);

  // Commissioner creates and collects team invoice
  const invoiceCreateRes = await pg.query(`
    select public.create_team_invoice(
      '${entry1Id}',
      '2026 Team Season Fee',
      120000,
      (current_date + 30)::date
    ) as invoice_id;
  `);

  const invoiceId = invoiceCreateRes.rows[0].invoice_id;

  // Record payment in full via e-transfer
  await pg.query(`
    select public.record_invoice_payment(
      '${invoiceId}',
      120000,
      'etransfer',
      'REF-123456',
      'Paid in full by team captain'
    );
  `);

  const invoiceRes = await pg.query(`
    select amount_cents, amount_paid_cents, status
    from public.league_invoices
    where id = '${invoiceId}';
  `);

  const invoice = invoiceRes.rows[0];
  assert.equal(invoice.amount_cents, 120000);
  assert.equal(invoice.amount_paid_cents, 120000);
  assert.equal(invoice.amount_cents - invoice.amount_paid_cents, 0);
  assert.equal(invoice.status, "paid");

  // 3. Live Scorekeeping & Match Events
  const goal1Id = "c0000000-0000-0000-0000-000000000021";
  const goal2Id = "c0000000-0000-0000-0000-000000000022";
  const goal3Id = "c0000000-0000-0000-0000-000000000023";

  // Timekeeper records match events
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${timekeeperId}', false);
  `);

  // Timekeeper records match events via add_game_event RPC
  await pg.query(`
    select public.add_game_event('${gameId}', gen_random_uuid(), 'goal', '${entry1Id}', 1, 900, '${p1Id}', null, null, null);
  `);
  await pg.query(`
    select public.add_game_event('${gameId}', gen_random_uuid(), 'goal', '${entry1Id}', 2, 450, '${p1Id}', null, null, null);
  `);
  await pg.query(`
    select public.add_game_event('${gameId}', gen_random_uuid(), 'goal', '${entry2Id}', 3, 120, '${p2Id}', null, null, null);
  `);

  // Timekeeper submits final result for official review
  await pg.query(`
    select public.submit_game_result('${gameId}', 'regulation', 'Final match scoresheet confirmed by off-ice crew');
  `);

  // 4. Commissioner Independent Review & Approval
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  await pg.query(`
    select public.review_game_result('${gameId}', true, 'Official scoresheet verified and approved by commissioner');
  `);

  // 5. Standings & Projections Verification
  const standings = (await pg.query(`select * from public.get_season_standings('${seasonId}');`)).rows;
  assert.equal(standings.length, 2);

  const homeTeam = standings.find((s) => s.team_entry_id === entry1Id);
  const awayTeam = standings.find((s) => s.team_entry_id === entry2Id);

  assert.equal(Number(homeTeam.rank), 1);
  assert.equal(Number(homeTeam.wins), 1);
  assert.equal(Number(homeTeam.points), 2);
  assert.equal(Number(homeTeam.goals_for), 2);
  assert.equal(Number(homeTeam.goals_against), 1);
  assert.equal(Number(homeTeam.goal_difference), 1);

  assert.equal(Number(awayTeam.rank), 2);
  assert.equal(Number(awayTeam.losses), 1);
  assert.equal(Number(awayTeam.points), 0);
  assert.equal(Number(awayTeam.goals_for), 1);
  assert.equal(Number(awayTeam.goals_against), 2);
  assert.equal(Number(awayTeam.goal_difference), -1);

  // 6. Automated Ledger Invariant & Operational Health Diagnostics
  const healthRes = await pg.query(`select public.check_league_system_health('${leagueId}') as health;`);
  const health = healthRes.rows[0].health;

  assert.equal(health.overall_status, "healthy");
  assert.equal(health.ledger_invariants.total_invoices, 1);
  assert.equal(health.ledger_invariants.total_billed_cents, 120000);
  assert.equal(health.ledger_invariants.total_collected_cents, 120000);
  assert.equal(health.ledger_invariants.outstanding_balance_cents, 0);
  assert.equal(health.ledger_invariants.anomalies_detected, 0);
  assert.equal(health.ledger_invariants.is_balanced, true);
  assert.equal(health.game_sheet_integrity.total_games, 1);
  assert.equal(health.game_sheet_integrity.pending_official_approvals, 0);
  assert.equal(health.roster_compliance.active_rostered_players, 2);
});
