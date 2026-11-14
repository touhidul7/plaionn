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

test("Phase 3: Licensed Video Streams and Event-Linked Highlights", async () => {
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
  ];

  for (const m of migrations) {
    await applyMigration(pg, m);
  }

  const leagueId = "40000000-0000-0000-0000-000000000001";
  const commUserId = "40000000-0000-0000-0000-000000000002";
  const mediaUserId = "40000000-0000-0000-0000-000000000003";
  const seasonId = "40000000-0000-0000-0000-000000000004";
  const divId = "40000000-0000-0000-0000-000000000005";
  const team1Id = "40000000-0000-0000-0000-000000000006";
  const team2Id = "40000000-0000-0000-0000-000000000007";
  const entry1Id = "40000000-0000-0000-0000-000000000008";
  const entry2Id = "40000000-0000-0000-0000-000000000009";
  const venueId = "40000000-0000-0000-0000-00000000000a";
  const rinkId = "40000000-0000-0000-0000-00000000000b";
  const gameId = "40000000-0000-0000-0000-00000000000c";
  const playerId = "40000000-0000-0000-0000-00000000000d";

  // Seed baseline data
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${commUserId}', 'commish@plaionn.com'),
      ('${mediaUserId}', 'media@plaionn.com');

    insert into public.leagues (id, name) values
      ('${leagueId}', 'PLAIONN Broadcast League');

    insert into public.league_memberships (league_id, user_id, role) values
      ('${leagueId}', '${commUserId}', 'commissioner'),
      ('${leagueId}', '${mediaUserId}', 'media');

    insert into public.seasons (id, league_id, name) values
      ('${seasonId}', '${leagueId}', '2026 Championship');

    insert into public.divisions (id, league_id, season_id, name) values
      ('${divId}', '${leagueId}', '${seasonId}', 'Elite Div');

    insert into public.teams (id, league_id, name) values
      ('${team1Id}', '${leagueId}', 'Storm'),
      ('${team2Id}', '${leagueId}', 'Thunder');

    insert into public.team_entries (id, league_id, division_id, team_id) values
      ('${entry1Id}', '${leagueId}', '${divId}', '${team1Id}'),
      ('${entry2Id}', '${leagueId}', '${divId}', '${team2Id}');

    insert into public.venues (id, league_id, name, address, time_zone) values
      ('${venueId}', '${leagueId}', 'Center Ice Arena', '500 Rink St', 'America/New_York');

    insert into public.rinks (id, league_id, venue_id, name) values
      ('${rinkId}', '${leagueId}', '${venueId}', 'Sheet 1');

    insert into public.games (id, league_id, home_entry_id, away_entry_id, rink_id, starts_at, ends_at, status) values
      ('${gameId}', '${leagueId}', '${entry1Id}', '${entry2Id}', '${rinkId}', now(), now() + interval '1 hour', 'scheduled');

    insert into public.players (id, display_name) values
      ('${playerId}', 'Alex Ovechkin');

    insert into public.league_players (league_id, player_id) values
      ('${leagueId}', '${playerId}');
  `);

  // 1. Media staff registers video broadcast
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${mediaUserId}', false);
  `);

  const streamRes = await pg.query(
    `select * from public.register_game_video_stream($1, $2, $3, $4, $5, $6, $7)`,
    [
      gameId,
      "youtube",
      "https://youtube.com/watch?v=demo12345",
      "Storm vs Thunder - Live HD Broadcast",
      "Main Center Ice",
      0,
      true
    ]
  );
  const stream = streamRes.rows[0];
  assert.equal(stream.stream_provider, "youtube");
  assert.equal(stream.is_live, true);

  // 2. Media staff clips a highlight
  const highlightRes = await pg.query(
    `select * from public.create_game_highlight($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      gameId,
      "Ovechkin One-Timer Powerplay Goal",
      "https://cdn.plaionn.com/clips/ovechkin_ppg.mp4",
      "goal",
      null,
      playerId,
      entry1Id,
      120,
      15,
      "https://cdn.plaionn.com/thumbs/ovechkin_goal.jpg"
    ]
  );
  const highlight = highlightRes.rows[0];
  assert.equal(highlight.title, "Ovechkin One-Timer Powerplay Goal");
  assert.equal(highlight.highlight_tag, "goal");

  // 3. Anonymous public viewer fetches game video package
  await pg.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  const pkgRes = await pg.query(
    `select public.get_game_video_package($1) as pkg`,
    [gameId]
  );
  const pkg = pkgRes.rows[0].pkg;
  assert.equal(pkg.game_id, gameId);
  assert.equal(pkg.streams.length, 1);
  assert.equal(pkg.streams[0].title, "Storm vs Thunder - Live HD Broadcast");
  assert.equal(pkg.highlights.length, 1);
  assert.equal(pkg.highlights[0].player_name, "Alex Ovechkin");

  console.log("Phase 3 video & highlights tests passed successfully!");
});
