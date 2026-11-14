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

test("Privacy & Compliance: Personal Data Export, Consent Revocation, and Profile Redaction", async () => {
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
    "202611160004_game_attendance_rsvp.sql",
    "202611160016_notifications_and_sms.sql",
    "202611160035_privacy_export_and_consent_withdrawal.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "80000000-0000-0000-0000-000000000001";
  const playerUserId = "80000000-0000-0000-0000-000000000002";
  const seasonId = "80000000-0000-0000-0000-000000000003";
  const divId = "80000000-0000-0000-0000-000000000004";
  const teamId = "80000000-0000-0000-0000-000000000005";
  const entryId = "80000000-0000-0000-0000-000000000006";
  const playerId = "80000000-0000-0000-0000-000000000007";
  const regId = "80000000-0000-0000-0000-000000000008";

  await pg.exec(`
    insert into auth.users (id, email) values ('${playerUserId}', 'privacyplayer@plaionn.com');
    insert into public.leagues (id, name) values ('${leagueId}', 'Pacific Hockey League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${playerUserId}', 'player');

    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', '2026 Summer Cup');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Tier 1');

    insert into public.teams (id, league_id, name) values ('${teamId}', '${leagueId}', 'Seals');
    insert into public.team_entries (id, league_id, division_id, team_id) values ('${entryId}', '${leagueId}', '${divId}', '${teamId}');

    insert into public.players (id, display_name, owner_user_id) values ('${playerId}', 'Nathan MacKinnon', '${playerUserId}');
    insert into public.league_players (league_id, player_id) values ('${leagueId}', '${playerId}');
    insert into public.roster_memberships (league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${leagueId}', '${entryId}', '${playerId}', 29, 'C', 'active');

    insert into public.player_registrations (id, league_id, season_id, user_id, player_id, season_name, league_name, position) values
      ('${regId}', '${leagueId}', '${seasonId}', '${playerUserId}', '${playerId}', '2026 Summer Cup', 'Pacific Hockey League', 'C');

    insert into public.registration_consents (id, registration_id, league_id, user_id, player_id, consent_type, consent_version, consent_text, granted) values
      (gen_random_uuid(), '${regId}', '${leagueId}', '${playerUserId}', '${playerId}', 'public_profile', 1, 'Allow player profile to appear in public standings.', true),
      (gen_random_uuid(), '${regId}', '${leagueId}', '${playerUserId}', '${playerId}', 'filming', 1, 'Allow game footage featuring you to be broadcast.', true);
  `);

  // 1. Test export_my_player_data
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${playerUserId}', false);
  `);

  const exportRes = await pg.query(`
    select public.export_my_player_data() as archive;
  `);

  const archive = exportRes.rows[0].archive;
  console.log("Archive output:", JSON.stringify(archive, null, 2));
  assert.equal(archive.account.email, "privacyplayer@plaionn.com");
  assert.equal(archive.player_profile.display_name, "Nathan MacKinnon");
  assert.equal(archive.registrations.length, 1);
  assert.equal(archive.consents.length, 2);
  assert.equal(archive.consents[0].granted, true);

  // 2. Test withdraw_registration_consent
  const withdrawRes = await pg.query(`
    select public.withdraw_registration_consent('${regId}', 'filming') as res;
  `);
  assert.equal(withdrawRes.rows[0].res, true);

  const checkConsent = await pg.query(`
    select granted from public.registration_consents
    where registration_id = '${regId}' and consent_type = 'filming';
  `);
  assert.equal(checkConsent.rows[0].granted, false, "Consent revoked successfully");

  // 3. Test anonymize_my_player_profile
  // Rejection if wrong confirmation text
  await assert.rejects(
    async () => {
      await pg.query(`select public.anonymize_my_player_profile('wrong string');`);
    },
    /Confirmation string does not match/
  );

  // Success with exact confirmation
  const anonymizeRes = await pg.query(`
    select public.anonymize_my_player_profile('anonymize my data') as res;
  `);
  assert.equal(anonymizeRes.rows[0].res, true);

  // Verify player display name redacted and owner detached (as superuser)
  await pg.exec(`reset role;`);
  const pCheck = await pg.query(`
    select display_name, owner_user_id from public.players where id = '${playerId}';
  `);
  assert.equal(pCheck.rows[0].display_name, "Redacted Player");
  assert.equal(pCheck.rows[0].owner_user_id, null);

  // Verify roster status retired to inactive
  const rCheck = await pg.query(`
    select status from public.roster_memberships where player_id = '${playerId}';
  `);
  assert.equal(rCheck.rows[0].status, "inactive");
});
