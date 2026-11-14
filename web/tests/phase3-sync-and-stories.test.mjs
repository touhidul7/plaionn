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

test("Phase 3: Video Period Clock Calibration and Vertical Story Highlights", async () => {
  const pg = new PGlite();

  await pg.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
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
    "202611060001_scored_matchup_guard.sql",
    "202611130001_game_results_standings.sql",
    "202611160001_onboarding_and_demo_access.sql",
    "202611160020_game_video_and_highlights.sql",
    "202611160031_video_sync_and_timecode_drift.sql",
    "202611160032_story_highlights_and_reels.sql",
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "50000000-0000-0000-0000-000000000001";
  const commUserId = "50000000-0000-0000-0000-000000000002";
  const fanUserId = "50000000-0000-0000-0000-000000000003";
  const seasonId = "50000000-0000-0000-0000-000000000004";
  const divId = "50000000-0000-0000-0000-000000000005";
  const team1Id = "50000000-0000-0000-0000-000000000006";
  const team2Id = "50000000-0000-0000-0000-000000000007";
  const entry1Id = "50000000-0000-0000-0000-000000000008";
  const entry2Id = "50000000-0000-0000-0000-000000000009";
  const venueId = "50000000-0000-0000-0000-00000000000a";
  const rinkId = "50000000-0000-0000-0000-00000000000b";
  const gameId = "50000000-0000-0000-0000-00000000000c";
  const playerId = "50000000-0000-0000-0000-00000000000d";

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'comm@example.com'),
      ('${fanUserId}', 'fan@example.com');

    insert into public.leagues (id, name) values ('${leagueId}', 'Metro Hockey League');
    insert into public.league_memberships (league_id, user_id, role) values ('${leagueId}', '${commUserId}', 'commissioner');

    insert into public.seasons (id, league_id, name) values ('${seasonId}', '${leagueId}', 'Winter 2026');
    insert into public.divisions (id, league_id, season_id, name) values ('${divId}', '${leagueId}', '${seasonId}', 'Division A');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Thunder'),
      ('${team2Id}', '${leagueId}', 'Blizzards');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values
      ('${venueId}', '${leagueId}', 'Metro Ice Center', '500 Rink St', 'America/New_York');

    insert into public.rinks (id, league_id, venue_id, name) values
      ('${rinkId}', '${leagueId}', '${venueId}', 'Rink 1');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now(), now() + interval '1 hour', 'scheduled');

    insert into public.players (id, display_name) values
      ('${playerId}', 'Connor McSniper');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${playerId}');
  `);

  // 1. Register broadcast video stream
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${commUserId}', false);
  `);

  const streamRes = await pg.query(`
    select * from public.register_game_video_stream(
      '${gameId}',
      'youtube',
      'https://youtube.com/watch?v=live123',
      'Live Center Ice Camera',
      'broadcast',
      0,
      true
    );
  `);
  const streamId = streamRes.rows[0].id;
  assert.ok(streamId, "Stream registered successfully");

  // 2. Calibrate period puck drops
  const syncP1 = await pg.query(`
    select * from public.set_period_video_sync(
      '${streamId}',
      1,
      120,
      1320
    );
  `);
  assert.equal(syncP1.rows[0].puck_drop_video_second, 120);

  const syncP2 = await pg.query(`
    select * from public.set_period_video_sync(
      '${streamId}',
      2,
      1500,
      2700
    );
  `);
  assert.equal(syncP2.rows[0].puck_drop_video_second, 1500);

  // 3. Test convert_game_clock_to_video_time
  // Period 1, clock at 18:30 (standard 20 min period, 90 sec elapsed) -> 120 + 90 = 210
  const conv1 = await pg.query(`
    select public.convert_game_clock_to_video_time(
      '${gameId}',
      1,
      1110,
      20
    ) as video_time;
  `);
  assert.equal(conv1.rows[0].video_time, 210);

  // Period 2, clock at 15:00 (5 min elapsed = 300s) -> 1500 + 300 = 1800
  const conv2 = await pg.query(`
    select public.convert_game_clock_to_video_time(
      '${gameId}',
      2,
      900,
      20
    ) as video_time;
  `);
  assert.equal(conv2.rows[0].video_time, 1800);

  // 4. Publish Mobile Vertical Story Highlights
  const story1 = await pg.query(`
    select * from public.publish_mobile_story_clip(
      '${leagueId}',
      'Connor coast-to-coast top shelf blast!',
      'https://cdn.example.com/stories/goal1.mp4',
      15.5,
      '${gameId}',
      null,
      'What a goal in the first period!',
      'https://cdn.example.com/stories/thumb1.jpg',
      '9:16',
      array['${playerId}']::uuid[]
    );
  `);
  assert.equal(story1.rows[0].title, "Connor coast-to-coast top shelf blast!");
  assert.equal(story1.rows[0].sequence_order, 1);
  const story1Id = story1.rows[0].id;

  const story2 = await pg.query(`
    select * from public.publish_mobile_story_clip(
      '${leagueId}',
      'Robbery with the glove hand!',
      'https://cdn.example.com/stories/save1.mp4',
      12.0,
      '${gameId}',
      null,
      'Unbelievable save across the crease!',
      'https://cdn.example.com/stories/thumb2.jpg',
      '9:16',
      array[]::uuid[]
    );
  `);
  assert.equal(story2.rows[0].sequence_order, 2);

  // 5. Query Game Story Reel
  const reel = await pg.query(`
    select * from public.get_game_story_reel('${gameId}');
  `);
  assert.equal(reel.rows.length, 2);
  assert.equal(reel.rows[0].title, "Connor coast-to-coast top shelf blast!");
  const tagged = reel.rows[0].tagged_players;
  assert.equal(tagged.length, 1);
  assert.equal(tagged[0].display_name, "Connor McSniper");

  // 6. Test fan engagement (likes and views)
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${fanUserId}', false);
  `);

  const viewCount = await pg.query(`
    select public.record_story_engagement('${story1Id}', 'view') as cnt;
  `);
  assert.equal(viewCount.rows[0].cnt, 1);

  const likeCount = await pg.query(`
    select public.record_story_engagement('${story1Id}', 'like') as cnt;
  `);
  assert.equal(likeCount.rows[0].cnt, 1);
});
