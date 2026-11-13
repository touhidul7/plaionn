import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('public fan access allows guest schedule, standings, game center while preserving table RLS', async () => {
  const db = new PGlite();
  const league = id(100), season = id(200), division = id(300);
  const homeTeam = id(400), awayTeam = id(500), homeEntry = id(600), awayEntry = id(700);
  const venue = id(800), rink = id(900), draftGame = id(1000), pubGame = id(1100);
  const commissioner = id(1200);

  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);

    // Load foundational migrations
    await db.exec(await readFile(new URL('../supabase/migrations/202610260001_league_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610270001_season_settings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280001_rosters.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280002_scheduling.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610310001_official_assignments.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611040001_standings_tiebreakers.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611040002_game_events.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611130001_game_results_standings.sql', import.meta.url), 'utf8'));
    // Load public fan access migration
    await db.exec(await readFile(new URL('../supabase/migrations/202611160003_public_fan_access.sql', import.meta.url), 'utf8'));

    // Populate seed fixtures
    await db.query('insert into auth.users(id) values($1)', [commissioner]);
    await db.query("insert into leagues(id, name) values($1, 'Public Hockey League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner')", [league, commissioner]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Northline HC'), ($3, $2, 'Harbour Wolves')", [homeTeam, league, awayTeam]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4), ($5, $6, $7, $8)", [homeEntry, league, homeTeam, division, awayEntry, league, awayTeam, division]);
    await db.query("insert into venues(id, league_id, name, address, time_zone) values($1, $2, 'Metro Centre', '100 Main St', 'America/Toronto')", [venue, league]);
    await db.query("insert into rinks(id, league_id, venue_id, name) values($1, $2, $3, 'Rink A')", [rink, league, venue]);

    // Insert 1 draft game and 1 scheduled game
    await db.query("insert into games(id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values($1, $2, $3, $4, $5, now() + interval '1 day', now() + interval '1 day 2 hours', 'draft')", [draftGame, league, homeEntry, awayEntry, rink]);
    await db.query("insert into games(id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values($1, $2, $3, $4, $5, now() + interval '2 days', now() + interval '2 days 2 hours', 'scheduled')", [pubGame, league, homeEntry, awayEntry, rink]);

    // Switch to role: anon
    await db.exec('set role anon');

    // 1. Anon direct table query must fail (RLS denied)
    await assert.rejects(
      db.query('select * from games'),
      e => e.code === '42501'
    );

    // 2. Anon can get public league overview
    const defaultOverview = await db.query('select * from get_public_league_overview(null)');
    assert.equal(defaultOverview.rows.length, 1);
    assert.equal(defaultOverview.rows[0].league_id, '00000000-0000-4000-8000-000000000001');

    const overviewRes = await db.query('select * from get_public_league_overview($1)', [league]);
    assert.equal(overviewRes.rows.length, 1);
    const row = overviewRes.rows[0];
    assert.equal(row.league_name, 'Public Hockey League');
    assert.equal(row.seasons.length, 1);
    assert.equal(row.divisions.length, 1);
    assert.equal(row.teams.length, 2);

    // 3. Anon can view public schedule (draft game excluded, scheduled game included)
    const schedRes = await db.query('select * from get_public_schedule($1)', [league]);
    assert.equal(schedRes.rows.length, 1);
    assert.equal(schedRes.rows[0].game_id, pubGame);
    assert.equal(schedRes.rows[0].home_team_name, 'Northline HC');
    assert.equal(schedRes.rows[0].away_team_name, 'Harbour Wolves');
    assert.equal(schedRes.rows[0].venue_name, 'Metro Centre');

    // 4. Anon can view standings table
    const standingsRes = await db.query('select * from get_season_standings($1)', [season]);
    assert.equal(standingsRes.rows.length, 2);

    // 5. Anon can view public live game center
    const liveRes = await db.query('select * from get_public_live_game($1)', [pubGame]);
    assert.equal(liveRes.rows.length, 1);
    assert.equal(liveRes.rows[0].game_id, pubGame);
    assert.equal(liveRes.rows[0].home_score, 0);
    assert.equal(liveRes.rows[0].away_score, 0);

  } finally {
    await db.close();
  }
});
