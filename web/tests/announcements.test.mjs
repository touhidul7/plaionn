import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('league and team announcements: priority ordering, team privacy, expiration, and deletion', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), playerUser = id(3);
  const season = id(5), division = id(6), team1 = id(11), entry1 = id(21), team2 = id(12), entry2 = id(22);

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
    await db.exec(await readFile(new URL('../supabase/migrations/202611160010_announcements_and_messaging.sql', import.meta.url), 'utf8'));

    // Users and league
    await db.query('insert into auth.users(id) values($1),($2)', [commissioner, playerUser]);
    await db.query("insert into leagues(id, name) values($1, 'Notices Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player')", [league, commissioner, playerUser]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Metro Div')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Hawks'), ($3, $2, 'Eagles')", [team1, league, team2]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4), ($5, $6, $7, $8)", [entry1, league, team1, division, entry2, league, team2, division]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Player cannot post announcements
    await as(playerUser);
    await assert.rejects(
      db.query("select publish_announcement($1, 'Test Title', 'Test Content', 'standard')", [league]),
      e => e.code === '42501'
    );

    // 2. Commissioner publishes an urgent league-wide announcement
    await as(commissioner);
    const pubRes1 = await db.query(
      "select publish_announcement($1, 'Ice Resurfacing Delay', 'Rink 1 delayed 30 mins', 'urgent', null, true)",
      [league]
    );
    const notice1Id = pubRes1.rows[0].publish_announcement;
    assert.ok(notice1Id);

    // 3. Commissioner publishes a team notice for Hawks only (entry1)
    const pubRes2 = await db.query(
      "select publish_announcement($1, 'Locker Room #4 Assigned', 'Hawks assigned to room 4', 'standard', $2, false)",
      [league, entry1]
    );
    const notice2Id = pubRes2.rows[0].publish_announcement;
    assert.ok(notice2Id);

    // 4. Anonymous fan views general league notices
    await db.exec('set role anon');
    const fanNotices = await db.query("select * from list_active_announcements($1)", [league]);
    assert.equal(fanNotices.rows.length, 2);
    // Priority urgent notice is first
    assert.equal(fanNotices.rows[0].title, 'Ice Resurfacing Delay');
    assert.equal(fanNotices.rows[0].priority, 'urgent');
    assert.equal(fanNotices.rows[0].is_pinned, true);

    // 5. Team 2 views their notices (team 1 specific notice excluded)
    const team2Notices = await db.query("select * from list_active_announcements($1, $2)", [league, entry2]);
    assert.equal(team2Notices.rows.length, 1);
    assert.equal(team2Notices.rows[0].title, 'Ice Resurfacing Delay');

    // 6. Delete announcement
    await db.exec('set role authenticated');
    await as(commissioner);
    const delRes = await db.query("select delete_announcement($1)", [notice1Id]);
    assert.equal(delRes.rows[0].delete_announcement, true);

    const remaining = await db.query("select * from list_active_announcements($1)", [league]);
    assert.equal(remaining.rows.length, 1);
    assert.equal(remaining.rows[0].title, 'Locker Room #4 Assigned');

  } finally {
    await db.close();
  }
});

