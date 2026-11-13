import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('skater and goalie leaderboards accurately aggregate approved game events into points and GAA', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), referee = id(3);
  const season = id(5), division = id(6);
  const team1 = id(7), entry1 = id(8);
  const team2 = id(15), entry2 = id(16);
  const venue = id(12), rink = id(13), game = id(14);

  // Players
  const skater1 = id(21); // McDavid: 2G, 1A = 3 PTS
  const skater2 = id(22); // Draisaitl: 1G, 2A = 3 PTS
  const skater3 = id(23); // Matthews: 1G, 0A, 2 PIM = 1 PTS
  const goalie1 = id(31); // Skinner: 1 GA in 1 game -> GAA 1.00, 0 SO
  const goalie2 = id(32); // Woll: 3 GA in 1 game -> GAA 3.00, 0 SO

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
    await db.exec(await readFile(new URL('../supabase/migrations/202610310001_official_assignments.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611040002_game_events.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611130001_game_results_standings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160004_game_attendance_rsvp.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160005_player_and_goalie_stats.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2)', [commissioner, referee]);
    await db.query("insert into leagues(id, name) values($1, 'Stats Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'referee')", [league, commissioner, referee]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Oilers'), ($3, $2, 'Leafs')", [team1, league, team2]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4), ($5, $6, $7, $8)", [entry1, league, team1, division, entry2, league, team2, division]);

    // Roster players
    await db.query("insert into players(id, display_name) values($1, 'Connor McDavid'), ($2, 'Leon Draisaitl'), ($3, 'Auston Matthews'), ($4, 'Stuart Skinner'), ($5, 'Joseph Woll')", [skater1, skater2, skater3, goalie1, goalie2]);
    await db.query("insert into league_players values($1, $2), ($1, $3), ($1, $4), ($1, $5), ($1, $6)", [league, skater1, skater2, skater3, goalie1, goalie2]);
    await db.query(`insert into roster_memberships(id, league_id, team_entry_id, player_id, jersey_number, position, status) values
      ('${id(61)}', '${league}', '${entry1}', '${skater1}', 97, 'F', 'active'),
      ('${id(62)}', '${league}', '${entry1}', '${skater2}', 29, 'F', 'active'),
      ('${id(63)}', '${league}', '${entry1}', '${goalie1}', 74, 'G', 'active'),
      ('${id(64)}', '${league}', '${entry2}', '${skater3}', 34, 'F', 'active'),
      ('${id(65)}', '${league}', '${entry2}', '${goalie2}', 60, 'G', 'active')
    `);

    // Venue & game
    await db.query("insert into venues(id, league_id, name, address, time_zone) values($1, $2, 'Arena', '100 Ice Way', 'UTC')", [venue, league]);
    await db.query("insert into rinks(id, league_id, venue_id, name) values($1, $2, $3, 'Rink 1')", [rink, league, venue]);
    await db.query("insert into games(id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values($1, $2, $3, $4, $5, now() - interval '2 hours', now(), 'scheduled')", [game, league, entry1, entry2, rink]);

    // Game events:
    // Event 1: Goal by McDavid, assist Draisaitl
    await db.query("insert into game_events(game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, assist_one_id, recorded_by) values($1, $2, $3, 'goal', $4, 1, 600, $5, $6, $7)", [game, league, id(71), entry1, skater1, skater2, commissioner]);
    // Event 2: Goal by Draisaitl, assist McDavid
    await db.query("insert into game_events(game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, assist_one_id, recorded_by) values($1, $2, $3, 'goal', $4, 2, 500, $5, $6, $7)", [game, league, id(72), entry1, skater2, skater1, commissioner]);
    // Event 3: Goal by McDavid, unassisted
    await db.query("insert into game_events(game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, recorded_by) values($1, $2, $3, 'goal', $4, 3, 300, $5, $6)", [game, league, id(73), entry1, skater1, commissioner]);
    // Event 4: Goal by Matthews, unassisted
    await db.query("insert into game_events(game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, recorded_by) values($1, $2, $3, 'goal', $4, 3, 100, $5, $6)", [game, league, id(74), entry2, skater3, commissioner]);
    // Event 5: Penalty by Matthews (2 mins)
    await db.query("insert into game_events(game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, penalty_minutes, recorded_by) values($1, $2, $3, 'penalty', $4, 2, 200, $5, 2, $6)", [game, league, id(75), entry2, skater3, commissioner]);

    // Voided event (should be ignored): Goal by Draisaitl
    await db.query("insert into game_events(id, game_id, league_id, client_event_id, event_kind, team_entry_id, period, clock_seconds_remaining, player_id, recorded_by) values($1, $2, $3, $4, 'goal', $5, 1, 800, $6, $7)", [id(99), game, league, id(76), entry1, skater2, commissioner]);
    await db.query("insert into game_event_voids(event_id, game_id, league_id, voided_by, reason) values($1, $2, $3, $4, 'Disallowed - high stick')", [id(99), game, league, commissioner]);

    // Game approved result: Oilers 3, Leafs 1
    await db.query("insert into game_results(game_id, league_id, home_entry_id, away_entry_id, home_score, away_score, home_penalty_minutes, away_penalty_minutes, decision, status, submitted_by, reviewed_by, reviewed_at) values($1, $2, $3, $4, 3, 1, 0, 2, 'regulation', 'approved', $5, $6, now())", [game, league, entry1, entry2, commissioner, referee]);

    // Test Skater Leaders RPC
    const skaters = await db.query('select * from get_season_skater_leaders($1)', [season]);
    assert.ok(skaters.rows.length >= 3, 'Expected at least 3 skaters');

    // Rank 1: McDavid (2G, 1A = 3 PTS)
    assert.equal(skaters.rows[0].display_name, 'Connor McDavid');
    assert.equal(skaters.rows[0].goals, 2);
    assert.equal(skaters.rows[0].assists, 1);
    assert.equal(skaters.rows[0].points, 3);
    assert.equal(skaters.rows[0].games_played, 1);

    // Rank 2: Draisaitl (1G, 1A = 2 PTS) - voided goal was properly excluded!
    assert.equal(skaters.rows[1].display_name, 'Leon Draisaitl');
    assert.equal(skaters.rows[1].goals, 1);
    assert.equal(skaters.rows[1].assists, 1);
    assert.equal(skaters.rows[1].points, 2);

    // Matthews: 1G, 0A = 1 PTS, 2 PIM
    const matthews = skaters.rows.find(s => s.display_name === 'Auston Matthews');
    assert.ok(matthews);
    assert.equal(matthews.goals, 1);
    assert.equal(matthews.assists, 0);
    assert.equal(matthews.points, 1);
    assert.equal(matthews.penalty_minutes, 2);

    // Test Goalie Leaders RPC
    const goalies = await db.query('select * from get_season_goalie_leaders($1)', [season]);
    assert.equal(goalies.rows.length, 2);

    // Skinner (Oilers): 1 GA in 1 game -> GAA 1.00
    const skinner = goalies.rows.find(g => g.display_name === 'Stuart Skinner');
    assert.ok(skinner);
    assert.equal(skinner.games_played, 1);
    assert.equal(skinner.goals_against, 1);
    assert.equal(Number(skinner.goals_against_average), 1.00);

    // Woll (Leafs): 3 GA in 1 game -> GAA 3.00
    const woll = goalies.rows.find(g => g.display_name === 'Joseph Woll');
    assert.ok(woll);
    assert.equal(woll.games_played, 1);
    assert.equal(woll.goals_against, 3);
    assert.equal(Number(woll.goals_against_average), 3.00);

  } finally {
    await db.close();
  }
});

