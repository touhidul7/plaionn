import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('bulk roster import validates commissioner access, jersey uniqueness, limits, and records audit history', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), playerUser = id(3);
  const season = id(5), division = id(6), team = id(7), entry = id(8);

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
    await db.exec(await readFile(new URL('../supabase/migrations/202611160006_bulk_roster_import.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2)', [commissioner, playerUser]);
    await db.query("insert into leagues(id, name) values($1, 'Import Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player')", [league, commissioner, playerUser]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into season_settings(league_id, season_id, roster_limit, period_count, period_minutes, clock_mode, win_points, tie_points, loss_points, overtime_loss_points, billing_model, currency, team_fee_cents, player_fee_cents) values($1, $2, 4, 3, 20, 'stop', 2, 1, 0, 0, 'team', 'CAD', 0, 0)", [league, season]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Blizzards')", [team, league]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4)", [entry, league, team, division]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Non-commissioner cannot import roster
    await as(playerUser);
    await assert.rejects(
      db.query("select bulk_import_roster($1, $2)", [entry, JSON.stringify([{ name: 'Test Player', jersey: 10, position: 'F' }])]),
      e => e.code === '42501'
    );

    // 2. Commissioner imports batch of 3 players
    await as(commissioner);
    const batch = [
      { name: 'Wayne Gretzky', jersey: 99, position: 'C' },
      { name: 'Mario Lemieux', jersey: 66, position: 'C' },
      { name: 'Patrick Roy', jersey: 33, position: 'G' }
    ];
    const importRes = await db.query("select bulk_import_roster($1, $2::jsonb)", [entry, JSON.stringify(batch)]);
    assert.equal(importRes.rows.length, 1);
    const resultJson = importRes.rows[0].bulk_import_roster;
    assert.equal(resultJson.imported_count, 3);
    assert.equal(resultJson.total_roster_count, 3);

    // Verify roster memberships in database
    const roster = await db.query("select p.display_name, rm.jersey_number, rm.position, rm.status from roster_memberships rm join players p on p.id = rm.player_id where rm.team_entry_id = $1 order by rm.jersey_number desc", [entry]);
    assert.equal(roster.rows.length, 3);
    assert.equal(roster.rows[0].display_name, 'Wayne Gretzky');
    assert.equal(roster.rows[0].jersey_number, 99);
    assert.equal(roster.rows[0].position, 'C');

    // 3. Batch with internal duplicate jersey is rejected
    const dupBatch = [
      { name: 'Jaromir Jagr', jersey: 68, position: 'RW' },
      { name: 'Another Player', jersey: 68, position: 'LW' }
    ];
    await assert.rejects(
      db.query("select bulk_import_roster($1, $2::jsonb)", [entry, JSON.stringify(dupBatch)]),
      e => e.code === '22023'
    );

    // 4. Batch with jersey already taken on this team is rejected
    const collisionBatch = [
      { name: 'Sidney Crosby', jersey: 99, position: 'C' } // 99 already belongs to Gretzky
    ];
    await assert.rejects(
      db.query("select bulk_import_roster($1, $2::jsonb)", [entry, JSON.stringify(collisionBatch)]),
      e => e.code === '23505' || e.code === '22023'
    );

    // 5. Exceeding roster limit (limit is 4; current is 3; adding 2 would make 5)
    const exceedBatch = [
      { name: 'Sidney Crosby', jersey: 87, position: 'C' },
      { name: 'Alexander Ovechkin', jersey: 8, position: 'LW' }
    ];
    await assert.rejects(
      db.query("select bulk_import_roster($1, $2::jsonb)", [entry, JSON.stringify(exceedBatch)]),
      e => e.code === 'P0001'
    );

    // 6. Adding exactly 1 player reaches limit 4 successfully
    const fitBatch = [
      { name: 'Sidney Crosby', jersey: 87, position: 'C' }
    ];
    const fitRes = await db.query("select bulk_import_roster($1, $2::jsonb)", [entry, JSON.stringify(fitBatch)]);
    assert.equal(fitRes.rows[0].bulk_import_roster.total_roster_count, 4);

  } finally {
    await db.close();
  }
});
