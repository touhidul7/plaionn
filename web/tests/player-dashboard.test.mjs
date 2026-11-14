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

test("Player Portal: Unified Dashboard with Teams, Schedule, Stats, Dues, and Documents", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create schema storage;
    create table storage.buckets(id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(bucket_id text not null, name text not null, primary key(bucket_id, name));
    alter table storage.objects enable row level security;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public, storage to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    grant select, insert, delete on storage.objects to authenticated;
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
    "202611090001_documents_consents.sql",
    "202611130001_game_results_standings.sql",
    "202611160001_onboarding_and_demo_access.sql",
    "202611160002_billing_and_invoices.sql",
    "202611160004_game_attendance_rsvp.sql",
    "202611160010_announcements_and_messaging.sql",
    "202611160033_player_dashboard_portal.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "60000000-0000-0000-0000-000000000001";
  const playerUserId = "60000000-0000-0000-0000-000000000002";
  const commUserId = "60000000-0000-0000-0000-000000000003";
  const unlinkedUserId = "60000000-0000-0000-0000-000000000004";
  const seasonId = "60000000-0000-0000-0000-000000000005";
  const divId = "60000000-0000-0000-0000-000000000006";
  const team1Id = "60000000-0000-0000-0000-000000000007";
  const team2Id = "60000000-0000-0000-0000-000000000008";
  const entry1Id = "60000000-0000-0000-0000-000000000009";
  const entry2Id = "60000000-0000-0000-0000-00000000000a";
  const venueId = "60000000-0000-0000-0000-00000000000b";
  const rinkId = "60000000-0000-0000-0000-00000000000c";
  const gameId = "60000000-0000-0000-0000-00000000000d";
  const playerId = "60000000-0000-0000-0000-00000000000e";
  const teammateId = "60000000-0000-0000-0000-00000000000f";

  // 1. Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com'),
      ('${playerUserId}', 'starplayer@plaionn.com'),
      ('${unlinkedUserId}', 'newuser@plaionn.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'National Metro League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner'),
      ('${leagueId}', '${playerUserId}', 'player');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', '2026 Spring Invitational');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${divId}', '${leagueId}', '${seasonId}', 'Premier Division');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Vipers'),
      ('${team2Id}', '${leagueId}', 'Cougars');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values
      ('${venueId}', '${leagueId}', 'Metro Sports Arena', '100 Main St', 'America/New_York');

    insert into public.rinks (id, league_id, venue_id, name) values
      ('${rinkId}', '${leagueId}', '${venueId}', 'Ice Pad 1');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now() + interval '2 days', now() + interval '2 days 1 hour', 'scheduled');

    -- Player claimed profile
    insert into public.players (id, display_name, owner_user_id) values
      ('${playerId}', 'Sidney Crosby', '${playerUserId}'),
      ('${teammateId}', 'Evgeni Malkin', null);

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${playerId}'),
      ('${leagueId}', '${teammateId}');

    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entry1Id}', '${playerId}', 87, 'C', 'active'),
      ('${leagueId}', '${entry1Id}', '${teammateId}', 71, 'C', 'active');
  `);

  // 2. Unlinked user dashboard test
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${unlinkedUserId}', false);
  `);

  const unlinkedRes = await pg.query(`
    select public.get_player_portal_dashboard() as d;
  `);
  assert.equal(unlinkedRes.rows[0].d.has_profile, false);

  // 3. Authenticate as player
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${playerUserId}', false);
  `);

  // Seed RSVP
  await pg.query(`
    select public.save_game_rsvp(
      '${gameId}',
      '${playerId}',
      'attending',
      'Ready to play!'
    );
  `);

  // Switch to superuser to seed stats, invoices, documents
  await pg.exec(`
    reset role;
  `);

  // Goal event
  await pg.exec(`
    insert into public.game_events (id, league_id, game_id, client_event_id, team_entry_id, player_id, assist_one_id, event_kind, period, clock_seconds_remaining, recorded_by) values
      (gen_random_uuid(), '${leagueId}', '${gameId}', gen_random_uuid(), '${entry1Id}', '${playerId}', '${teammateId}', 'goal', 1, 600, '${commUserId}'),
      (gen_random_uuid(), '${leagueId}', '${gameId}', gen_random_uuid(), '${entry1Id}', '${teammateId}', '${playerId}', 'goal', 2, 300, '${commUserId}');

    insert into public.game_events (id, league_id, game_id, client_event_id, team_entry_id, player_id, event_kind, period, clock_seconds_remaining, penalty_minutes, recorded_by) values
      (gen_random_uuid(), '${leagueId}', '${gameId}', gen_random_uuid(), '${entry1Id}', '${playerId}', 'penalty', 3, 100, 2, '${commUserId}');

    -- Invoice
    insert into public.league_invoices (league_id, season_id, recipient_type, player_id, title, amount_cents, amount_paid_cents, currency, status) values
      ('${leagueId}', '${seasonId}', 'player', '${playerId}', 'Spring Season Player Dues', 45000, 20000, 'CAD', 'partially_paid');

    -- Registration and Document acceptance
    insert into public.player_registrations (id, league_id, season_id, user_id, player_id, season_name, league_name, position) values
      (gen_random_uuid(), '${leagueId}', '${seasonId}', '${playerUserId}', '${playerId}', '2026 Spring Invitational', 'National Metro League', 'C');

    insert into public.season_documents (id, league_id, season_id, document_type, title, version, object_path, file_name, file_size, sha256, created_by) values
      ('70000000-0000-0000-0000-000000000001', '${leagueId}', '${seasonId}', 'waiver', '2026 Player Liability Waiver', 1, 'waivers/waiver_v1.pdf', 'waiver.pdf', 1024, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '${commUserId}');

    insert into public.registration_document_acceptances (league_id, registration_id, user_id, player_id, document_id, document_title, document_version, document_sha256, signer_name)
    select '${leagueId}', id, '${playerUserId}', '${playerId}', '70000000-0000-0000-0000-000000000001', '2026 Player Liability Waiver', 1, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Sidney Crosby'
    from public.player_registrations where player_id = '${playerId}' limit 1;

    -- Announcement
    insert into public.league_announcements (league_id, title, message, priority) values
      ('${leagueId}', 'Playoff Tournament Dates Announced', 'The spring playoffs begin next week. Good luck to all teams!', 'urgent');
  `);

  // 4. Query player portal dashboard
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${playerUserId}', false);
  `);

  const playerRes = await pg.query(`
    select public.get_player_portal_dashboard() as d;
  `);
  const d = playerRes.rows[0].d;

  assert.equal(d.has_profile, true);
  assert.equal(d.display_name, "Sidney Crosby");

  // Verify teams
  assert.equal(d.teams.length, 1);
  assert.equal(d.teams[0].team_name, "Vipers");
  assert.equal(d.teams[0].jersey_number, 87);
  assert.equal(d.teams[0].position, "C");

  // Verify upcoming games
  assert.equal(d.upcoming_games.length, 1);
  assert.equal(d.upcoming_games[0].my_team_name, "Vipers");
  assert.equal(d.upcoming_games[0].opponent_team_name, "Cougars");
  assert.equal(d.upcoming_games[0].my_rsvp, "attending");
  assert.equal(d.upcoming_games[0].rsvp_note, "Ready to play!");

  // Verify stats
  assert.equal(d.career_stats.goals, 1);
  assert.equal(d.career_stats.assists, 1);
  assert.equal(d.career_stats.points, 2);
  assert.equal(d.career_stats.pim, 2);
  assert.equal(d.career_stats.games_played, 1);

  // Verify invoice balance
  assert.equal(d.invoices.length, 1);
  assert.equal(d.invoices[0].amount_cents, 45000);
  assert.equal(d.invoices[0].amount_paid_cents, 20000);
  assert.equal(d.invoices[0].balance_cents, 25000);
  assert.equal(d.invoices[0].status, "partially_paid");

  // Verify documents
  assert.equal(d.documents.length, 1);
  assert.equal(d.documents[0].title, "2026 Player Liability Waiver");
  assert.equal(d.documents[0].signer_name, "Sidney Crosby");

  // Verify announcements
  assert.equal(d.announcements.length, 1);
  assert.equal(d.announcements[0].title, "Playoff Tournament Dates Announced");
});
