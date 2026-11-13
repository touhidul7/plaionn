import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('spare player and goalie pool discovery, call-ups, and game eligibility enforcement', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), goalieUser = id(3), suspendedUser = id(4);
  const season = id(5), division = id(6), team = id(11), entry = id(21), otherTeam = id(12), otherEntry = id(22);
  const goaliePlayer = id(31), suspendedPlayer = id(32);
  const venue = id(40), rink = id(41), game = id(42);

  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);

    // Prerequisites
    await db.exec(await readFile(new URL('../supabase/migrations/202610260001_league_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610270001_season_settings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280001_rosters.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280002_scheduling.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610310002_registration.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160008_discipline_and_suspensions.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160009_spare_goalie_callups.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2),($3)', [commissioner, goalieUser, suspendedUser]);
    await db.query("insert into leagues(id, name) values($1, 'Spares Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player'), ($1, $4, 'player')", [league, commissioner, goalieUser, suspendedUser]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Hawks'), ($3, $2, 'Eagles')", [team, league, otherTeam]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4), ($5, $6, $7, $8)", [entry, league, team, division, otherEntry, league, otherTeam, division]);

    // Players
    await db.query("insert into players(id, display_name, owner_user_id) values($1, 'Martin Brodeur', $3), ($2, 'Dirty Player', $4)", [goaliePlayer, suspendedPlayer, goalieUser, suspendedUser]);
    await db.query("insert into league_players values($1, $2), ($1, $3)", [league, goaliePlayer, suspendedPlayer]);

    // Suspend player 2
    await db.query("insert into disciplinary_incidents(league_id, season_id, player_id, team_entry_id, infraction, games_suspended, games_served, status) values($1, $2, $3, $4, 'Gross Misconduct', 3, 0, 'active')", [league, season, suspendedPlayer, otherEntry]);

    // Venue, rink, scheduled game
    await db.query("insert into venues(id, league_id, name, address, time_zone) values($1, $2, 'Metro Ice', '123 Main', 'America/Toronto')", [venue, league]);
    await db.query("insert into rinks(id, league_id, venue_id, name) values($1, $2, $3, 'Rink A')", [rink, league, venue]);
    await db.query("insert into games(id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values($1, $2, $3, $4, $5, now() + interval '1 day', now() + interval '1 day 2 hours', 'scheduled')", [game, league, entry, otherEntry, rink]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Goalie registers availability in the spare pool
    await as(goalieUser);
    const poolRes = await db.query(
      "select register_spare_availability($1, $2, 'G', 'Advanced', true, 'Available weekday evenings')",
      [league, goaliePlayer]
    );
    assert.ok(poolRes.rows[0].register_spare_availability);

    // 2. Query available spares via anon fan / captain
    await db.exec('set role anon');
    const sparesList = await db.query("select * from list_available_spares($1, 'G')", [league]);
    assert.equal(sparesList.rows.length, 1);
    assert.equal(sparesList.rows[0].player_name, 'Martin Brodeur');
    assert.equal(sparesList.rows[0].preferred_position, 'G');
    assert.equal(sparesList.rows[0].is_suspended, false);

    // 3. Commissioner attempts to call up the suspended player (should be rejected)
    await db.exec('set role authenticated');
    await as(commissioner);
    await assert.rejects(
      db.query("select request_game_callup($1, $2, $3, 'F', 99)", [game, entry, suspendedPlayer]),
      e => e.code === '22023'
    );

    // 4. Commissioner calls up Goalie for team entry
    const callupRes = await db.query(
      "select request_game_callup($1, $2, $3, 'G', 30)",
      [game, entry, goaliePlayer]
    );
    const callupId = callupRes.rows[0].request_game_callup;
    assert.ok(callupId);

    // 5. Goalie accepts call-up
    await as(goalieUser);
    const acceptRes = await db.query("select respond_to_callup($1, true)", [callupId]);
    assert.equal(acceptRes.rows[0].respond_to_callup, true);

    // 6. Inspect game call-ups
    const gameCallups = await db.query("select * from list_game_callups($1)", [game]);
    assert.equal(gameCallups.rows.length, 1);
    assert.equal(gameCallups.rows[0].player_name, 'Martin Brodeur');
    assert.equal(gameCallups.rows[0].player_position, 'G');
    assert.equal(gameCallups.rows[0].status, 'accepted');
    assert.equal(gameCallups.rows[0].jersey_number, 30);
    assert.equal(gameCallups.rows[0].team_name, 'Hawks');

  } finally {
    await db.close();
  }
});
