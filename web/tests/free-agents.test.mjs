import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('free agent registration, vacancy postings, player applications, and automated roster placement', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), playerUser = id(3);
  const season = id(5), division = id(6), team = id(11), entry = id(21);
  const player = id(31);

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
    await db.exec(await readFile(new URL('../supabase/migrations/202610310002_registration.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160011_free_agents_and_teams.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2)', [commissioner, playerUser]);
    await db.query("insert into leagues(id, name) values($1, 'Free Agents Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player')", [league, commissioner, playerUser]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Hawks')", [team, league]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4)", [entry, league, team, division]);

    // Player owned by playerUser
    await db.query("insert into players(id, display_name, owner_user_id) values($1, 'Teemu Selanne', $2)", [player, playerUser]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Player registers as free agent
    await as(playerUser);
    const regRes = await db.query(
      "select register_free_agent($1, $2, 'F', 'Advanced', $3, 'Experienced right winger looking for competitive team')",
      [league, player, division]
    );
    const faId = regRes.rows[0].register_free_agent;
    assert.ok(faId);

    // 2. Query available free agents via anon fan / captain
    await db.exec('set role anon');
    const faList = await db.query("select * from list_free_agents($1)", [league]);
    assert.equal(faList.rows.length, 1);
    assert.equal(faList.rows[0].player_name, 'Teemu Selanne');
    assert.equal(faList.rows[0].preferred_position, 'F');
    assert.equal(faList.rows[0].status, 'seeking');

    // 3. Commissioner posts team vacancy listing for Hawks
    await db.exec('set role authenticated');
    await as(commissioner);
    const vacRes = await db.query(
      "select post_team_vacancy($1, array['F', 'D'], 'Looking for top 6 forward and puck moving defenseman', 2)",
      [entry]
    );
    const vacancyId = vacRes.rows[0].post_team_vacancy;
    assert.ok(vacancyId);

    // 4. Query active vacancies
    const vacancies = await db.query("select * from list_team_vacancies($1)", [league]);
    assert.equal(vacancies.rows.length, 1);
    assert.equal(vacancies.rows[0].team_name, 'Hawks');
    assert.equal(vacancies.rows[0].spots_available, 2);

    // 5. Free agent applies to vacancy
    await as(playerUser);
    const appRes = await db.query(
      "select apply_to_vacancy($1, $2, 'Would love to play for Hawks!')",
      [vacancyId, player]
    );
    const appId = appRes.rows[0].apply_to_vacancy;
    assert.ok(appId);

    // 6. Commissioner accepts application
    await as(commissioner);
    const reviewRes = await db.query("select review_vacancy_application($1, true, 8)", [appId]);
    assert.equal(reviewRes.rows[0].review_vacancy_application, true);

    // 7. Verify player was automatically added to team roster in roster_memberships!
    const rosterCheck = await db.query(
      "select * from roster_memberships where team_entry_id = $1 and player_id = $2",
      [entry, player]
    );
    assert.equal(rosterCheck.rows.length, 1);
    assert.equal(rosterCheck.rows[0].jersey_number, 8);
    assert.equal(rosterCheck.rows[0].status, 'active');

    // 8. Verify free agent status is now 'placed'
    const placedCheck = await db.query("select status from free_agent_profiles where id = $1", [faId]);
    assert.equal(placedCheck.rows[0].status, 'placed');

    // 9. Verify vacancy spots decremented from 2 to 1
    const vacCheck = await db.query("select spots_available from team_vacancy_listings where id = $1", [vacancyId]);
    assert.equal(vacCheck.rows[0].spots_available, 1);

  } finally {
    await db.close();
  }
});
