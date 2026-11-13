import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('discipline and suspensions: incident recording, eligibility checks, appeals, and commissioner review', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), playerUser = id(3), otherUser = id(4);
  const season = id(5), division = id(6), team = id(11), entry = id(21), player = id(31);

  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);

    // Load prerequisites
    await db.exec(await readFile(new URL('../supabase/migrations/202610260001_league_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610270001_season_settings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280001_rosters.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280002_scheduling.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610310002_registration.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160008_discipline_and_suspensions.sql', import.meta.url), 'utf8'));

    // Users and league setup
    await db.query('insert into auth.users(id) values($1),($2),($3)', [commissioner, playerUser, otherUser]);
    await db.query("insert into leagues(id, name) values($1, 'Discipline Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player'), ($1, $4, 'player')", [league, commissioner, playerUser, otherUser]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Tier 1')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Thunder HC')", [team, league]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4)", [entry, league, team, division]);

    // Player owned by playerUser
    await db.query("insert into players(id, owner_user_id, display_name) values($1, $2, 'Alex Kovalev')", [player, playerUser]);
    await db.query("insert into league_players values($1, $2)", [league, player]);
    await db.query("insert into roster_memberships(id, league_id, team_entry_id, player_id, jersey_number, position, status) values($1, $2, $3, $4, 27, 'F', 'active')", [id(50), league, entry, player]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Non-commissioner cannot record disciplinary incident
    await as(playerUser);
    await assert.rejects(
      db.query("select record_disciplinary_incident($1, $2, $3, $4, 'Abuse of Officials', 3, 10)", [league, season, player, entry]),
      e => e.code === '42501'
    );

    // 2. Commissioner records 3-game suspension for Match Penalty
    await as(commissioner);
    const incRes = await db.query(
      "select record_disciplinary_incident($1, $2, $3, $4, 'Match Penalty - Deliberate Injury', 3, 15, null, 'Boarding incident in period 3')",
      [league, season, player, entry]
    );
    assert.equal(incRes.rows.length, 1);
    const incidentId = incRes.rows[0].record_disciplinary_incident;
    assert.ok(incidentId);

    // 3. Check is_player_suspended returns true
    const suspRes = await db.query("select is_player_suspended($1)", [player]);
    assert.equal(suspRes.rows[0].is_player_suspended, true);

    // 4. Query list_league_discipline
    const listRes = await db.query("select * from list_league_discipline($1)", [league]);
    assert.equal(listRes.rows.length, 1);
    const item = listRes.rows[0];
    assert.equal(item.player_name, 'Alex Kovalev');
    assert.equal(item.jersey_number, 27);
    assert.equal(item.team_name, 'Thunder HC');
    assert.equal(item.infraction, 'Match Penalty - Deliberate Injury');
    assert.equal(item.games_suspended, 3);
    assert.equal(item.games_remaining, 3);
    assert.equal(item.status, 'active');

    // 5. Another player cannot appeal Kovalev's suspension
    await as(otherUser);
    await assert.rejects(
      db.query("select submit_suspension_appeal($1, 'Not my player but please let him play')", [incidentId]),
      e => e.code === '42501'
    );

    // 6. Suspended player appeals suspension with statement
    await as(playerUser);
    const appealRes = await db.query(
      "select submit_suspension_appeal($1, 'Clean shoulder check along the boards, opponent turned late')",
      [incidentId]
    );
    assert.equal(appealRes.rows[0].submit_suspension_appeal, true);

    // Verify status changed to 'appealed'
    const appealedCheck = await db.query("select status, appeal_status, appeal_notes from disciplinary_incidents where id = $1", [incidentId]);
    assert.equal(appealedCheck.rows[0].status, 'appealed');
    assert.equal(appealedCheck.rows[0].appeal_status, 'pending');

    // 7. Non-commissioner cannot resolve appeal
    await assert.rejects(
      db.query("select resolve_suspension_appeal($1, 'overturned')", [incidentId]),
      e => e.code === '42501'
    );

    // 8. Commissioner resolves appeal by reducing to 1 game
    await as(commissioner);
    await db.query("select resolve_suspension_appeal($1, 'reduced', 1, 'Video confirms incidental contact, reduced to 1 game')", [incidentId]);

    const reducedCheck = await db.query("select games_suspended, appeal_status, status from disciplinary_incidents where id = $1", [incidentId]);
    assert.equal(reducedCheck.rows[0].games_suspended, 1);
    assert.equal(reducedCheck.rows[0].appeal_status, 'reduced');
    assert.equal(reducedCheck.rows[0].status, 'active');

    // 9. Commissioner overturns suspension completely
    await db.query("select resolve_suspension_appeal($1, 'overturned', null, 'Overturned upon full referee committee review')", [incidentId]);
    const overturnedCheck = await db.query("select status, appeal_status from disciplinary_incidents where id = $1", [incidentId]);
    assert.equal(overturnedCheck.rows[0].status, 'revoked');
    assert.equal(overturnedCheck.rows[0].appeal_status, 'overturned');

    // 10. Check is_player_suspended now returns false!
    const clearedRes = await db.query("select is_player_suspended($1)", [player]);
    assert.equal(clearedRes.rows[0].is_player_suspended, false);

    // 11. Anonymous fan can view disciplinary ledger
    await db.exec('set role anon');
    const anonLedger = await db.query("select * from list_league_discipline($1)", [league]);
    assert.equal(anonLedger.rows.length, 1);
    assert.equal(anonLedger.rows[0].status, 'revoked');

  } finally {
    await db.close();
  }
});
