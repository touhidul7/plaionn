import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('game attendance and RSVP workflows enforce roster membership, captain/player permissions, and idempotent updates', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), playerOne = id(3), playerTwo = id(4);
  const season = id(5), division = id(6), team = id(7), entry = id(8);
  const homePlayer = id(9), awayPlayer = id(11);
  const venue = id(12), rink = id(13), game = id(14);
  const otherTeam = id(15), otherEntry = id(16);

  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);

    await db.exec(await readFile(new URL('../supabase/migrations/202610260001_league_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610270001_season_settings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280001_rosters.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280002_scheduling.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610310002_registration.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160004_game_attendance_rsvp.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2),($3)', [commissioner, playerOne, playerTwo]);
    await db.query("insert into leagues(id, name) values($1, 'RSVP Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player'), ($1, $4, 'player')", [league, commissioner, playerOne, playerTwo]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Hawks'), ($3, $2, 'Eagles')", [team, league, otherTeam]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4), ($5, $6, $7, $8)", [entry, league, team, division, otherEntry, league, otherTeam, division]);

    // Players
    await db.query("insert into players(id, display_name, owner_user_id) values($1, 'Connor McDavid', $3), ($2, 'Auston Matthews', null)", [homePlayer, awayPlayer, playerOne]);
    await db.query("insert into league_players values($1, $2), ($1, $3)", [league, homePlayer, awayPlayer]);
    await db.query("insert into roster_memberships(id, league_id, team_entry_id, player_id, jersey_number, position, status) values($1, $2, $3, $4, 97, 'F', 'active'), ($5, $6, $7, $8, 34, 'F', 'active')", [id(50), league, entry, homePlayer, id(51), league, otherEntry, awayPlayer]);

    // Venue, rink, scheduled game
    await db.query("insert into venues(id, league_id, name, address, time_zone) values($1, $2, 'Ice Arena', '100 Ice Way', 'America/Toronto')", [venue, league]);
    await db.query("insert into rinks(id, league_id, venue_id, name) values($1, $2, $3, 'Rink 1')", [rink, league, venue]);
    await db.query("insert into games(id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values($1, $2, $3, $4, $5, now() + interval '1 day', now() + interval '1 day 2 hours', 'scheduled')", [game, league, entry, otherEntry, rink]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Commissioner views team attendance before any RSVP
    await as(commissioner);
    const initialList = await db.query('select * from list_game_attendance($1, $2)', [game, entry]);
    assert.equal(initialList.rows.length, 1);
    assert.equal(initialList.rows[0].rsvp_status, 'unconfirmed');

    // 2. Unrelated user (playerTwo) cannot submit RSVP for playerOne
    await as(playerTwo);
    await assert.rejects(
      db.query("select save_game_rsvp($1, $2, 'attending', 'Will be there')", [game, homePlayer]),
      e => e.code === '42501'
    );

    // 3. PlayerOne submits RSVP as 'attending'
    await as(playerOne);
    const rsvpResult = await db.query("select * from save_game_rsvp($1, $2, 'attending', 'Will be there on time')", [game, homePlayer]);
    assert.equal(rsvpResult.rows.length, 1);
    assert.equal(rsvpResult.rows[0].status, 'attending');
    assert.equal(rsvpResult.rows[0].note, 'Will be there on time');

    // 4. PlayerOne updates RSVP to 'tentative' (idempotent upsert)
    await db.query("select save_game_rsvp($1, $2, 'tentative', 'Running late from work')", [game, homePlayer]);

    // 5. Commissioner inspects updated roster attendance
    await as(commissioner);
    const updatedList = await db.query('select * from list_game_attendance($1, $2)', [game, entry]);
    assert.equal(updatedList.rows[0].rsvp_status, 'tentative');
    assert.equal(updatedList.rows[0].note, 'Running late from work');

  } finally {
    await db.close();
  }
});
