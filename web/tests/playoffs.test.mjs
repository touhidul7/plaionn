import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('playoff bracket generation seeds from standings, builds series tree, and advances winners', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), playerUser = id(3);
  const season = id(5), division = id(6);
  const team1 = id(11), entry1 = id(21);
  const team2 = id(12), entry2 = id(22);
  const team3 = id(13), entry3 = id(23);
  const team4 = id(14), entry4 = id(24);

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
    await db.exec(await readFile(new URL('../supabase/migrations/202611040001_standings_tiebreakers.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611040002_game_events.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611130001_game_results_standings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160003_public_fan_access.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160007_playoff_brackets.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2)', [commissioner, playerUser]);
    await db.query("insert into leagues(id, name) values($1, 'Playoffs Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player')", [league, commissioner, playerUser]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into season_settings(league_id, season_id, roster_limit, period_count, period_minutes, clock_mode, win_points, tie_points, loss_points, overtime_loss_points, billing_model, currency, team_fee_cents, player_fee_cents) values($1, $2, 20, 3, 20, 'stop', 2, 1, 0, 0, 'team', 'CAD', 0, 0)", [league, season]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);

    // 4 Teams and Entries
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Hawks'), ($3, $2, 'Eagles'), ($4, $2, 'Wolves'), ($5, $2, 'Bears')", [team1, league, team2, team3, team4]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)",
      [entry1, league, team1, division, entry2, league, team2, division, entry3, league, team3, division, entry4, league, team4, division]
    );

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Non-commissioner cannot generate bracket
    await as(playerUser);
    await assert.rejects(
      db.query("select generate_playoff_bracket($1, 'Championship Cup', 'single_elimination', 4)", [division]),
      e => e.code === '42501'
    );

    // 2. Commissioner generates 4-team Single Elimination bracket
    await as(commissioner);
    const genRes = await db.query("select generate_playoff_bracket($1, '2026 Metro Cup', 'single_elimination', 4)", [division]);
    assert.equal(genRes.rows.length, 1);
    const tournamentId = genRes.rows[0].generate_playoff_bracket;
    assert.ok(tournamentId);

    // 3. Inspect generated bracket structure
    const bracketRes = await db.query("select * from get_playoff_bracket($1)", [tournamentId]);
    assert.equal(bracketRes.rows.length, 1);
    const tournament = bracketRes.rows[0];
    assert.equal(tournament.name, '2026 Metro Cup');
    assert.equal(tournament.format, 'single_elimination');
    assert.equal(tournament.team_count, 4);

    const seriesList = tournament.series;
    assert.equal(seriesList.length, 3); // 2 semifinals + 1 final

    // Round 1 Semifinals:
    const semi1 = seriesList.find(s => s.round_number === 1 && s.series_order === 1);
    const semi2 = seriesList.find(s => s.round_number === 1 && s.series_order === 2);
    const finalSeries = seriesList.find(s => s.round_number === 2);

    assert.ok(semi1 && semi2 && finalSeries);
    assert.equal(semi1.high_seed_rank, 1);
    assert.equal(semi1.low_seed_rank, 4);
    assert.equal(semi2.high_seed_rank, 2);
    assert.equal(semi2.low_seed_rank, 3);

    // Both semifinals feed into the Final series
    assert.equal(semi1.next_series_id, finalSeries.id);
    assert.equal(semi2.next_series_id, finalSeries.id);

    // 4. Simulate Semifinal 1 victory: High seed (#1) advances
    await db.query(`update playoff_series set high_seed_wins = 1, winner_entry_id = high_seed_entry_id, status = 'completed' where id = $1`, [semi1.id]);
    await db.query("select advance_playoff_series_winner($1)", [semi1.id]);

    // Check final series now has high seed placed!
    const updatedFinal = await db.query("select high_seed_entry_id from playoff_series where id = $1", [finalSeries.id]);
    assert.equal(updatedFinal.rows[0].high_seed_entry_id, semi1.high_seed_entry_id);

    // 5. Public / anonymous fan can inspect the bracket directly or by division
    await db.exec('set role anon');
    const publicBracket = await db.query("select * from get_playoff_bracket($1)", [tournamentId]);
    assert.equal(publicBracket.rows.length, 1);
    assert.equal(publicBracket.rows[0].name, '2026 Metro Cup');

    const divBracket = await db.query("select * from get_division_playoff_bracket($1)", [division]);
    assert.equal(divBracket.rows.length, 1);
    assert.equal(divBracket.rows[0].tournament_id, tournamentId);

  } finally {
    await db.close();
  }
});
