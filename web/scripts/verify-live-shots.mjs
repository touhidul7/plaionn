import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import path from "node:path";
import assert from "node:assert/strict";

const { loadEnvConfig } = nextEnv;
const envDir = path.resolve(process.cwd(), "web");
loadEnvConfig(envDir, true, { info() {}, error() {} });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const DEMO_LEAGUE_ID = "60000000-0000-4000-8000-000000000001";
const DEMO_ENTRY_ID = "60000000-0000-4000-8000-000000000021"; // Northline HC
const COMMISSIONER_EMAIL = "reviewer_test_user@plaionn.com";
const COMMISSIONER_PASSWORD = "TestPassword123!@#";

async function verify() {
  console.log("=== Verifying Live Shots on Goal & Goaltender Boxscore Tracking ===");
  const anonClient = createClient(url, key);

  // 1. Authenticate as commissioner
  const commClient = createClient(url, key);
  const { error: authErr } = await commClient.auth.signInWithPassword({
    email: COMMISSIONER_EMAIL,
    password: COMMISSIONER_PASSWORD,
  });

  if (authErr) {
    console.error("❌ Commissioner login failed:", authErr.message);
    return false;
  }
  console.log(`✓ Commissioner authenticated (${COMMISSIONER_EMAIL})`);

  // 2. Fetch scheduled game in demo league
  const { data: games, error: gErr } = await commClient
    .from("games")
    .select("id, home_entry_id, away_entry_id")
    .eq("league_id", DEMO_LEAGUE_ID)
    .eq("status", "scheduled")
    .limit(1);

  if (gErr || !games || games.length === 0) {
    console.error("❌ No scheduled demo game found:", gErr?.message);
    return false;
  }
  const game = games[0];
  console.log(`✓ Found target game: ${game.id} (Home: ${game.home_entry_id}, Away: ${game.away_entry_id})`);

  // 3. Record Period Shots for Home and Away
  const { error: s1Err } = await commClient.rpc("record_period_shots", {
    target_game: game.id,
    target_team_entry: game.home_entry_id,
    target_period: 1,
    shot_count: 12,
  });
  if (s1Err) {
    console.error("❌ record_period_shots (Home P1) error:", s1Err.message);
    return false;
  }

  await commClient.rpc("record_period_shots", {
    target_game: game.id,
    target_team_entry: game.home_entry_id,
    target_period: 2,
    shot_count: 14,
  });
  await commClient.rpc("record_period_shots", {
    target_game: game.id,
    target_team_entry: game.home_entry_id,
    target_period: 3,
    shot_count: 9,
  });

  await commClient.rpc("record_period_shots", {
    target_game: game.id,
    target_team_entry: game.away_entry_id,
    target_period: 1,
    shot_count: 8,
  });
  await commClient.rpc("record_period_shots", {
    target_game: game.id,
    target_team_entry: game.away_entry_id,
    target_period: 2,
    shot_count: 11,
  });
  await commClient.rpc("record_period_shots", {
    target_game: game.id,
    target_team_entry: game.away_entry_id,
    target_period: 3,
    shot_count: 7,
  });
  console.log("✓ Recorded period shots for both teams (Home: 12/14/9=35, Away: 8/11/7=26)");

  // 4. Fetch Goalie from home roster
  const { data: roster, error: rErr } = await commClient
    .from("roster_memberships")
    .select("player_id, jersey_number")
    .eq("team_entry_id", game.home_entry_id)
    .limit(1);

  if (rErr || !roster || roster.length === 0) {
    console.error("❌ Could not fetch player from roster:", rErr?.message);
    return false;
  }

  const playerId = roster[0].player_id;
  const { data: playerRec } = await commClient
    .from("players")
    .select("id, display_name")
    .eq("id", playerId)
    .single();

  const goalie = {
    player_id: playerId,
    name: playerRec?.display_name || "Demo Goalie",
  };
  console.log(`✓ Using goaltender: ${goalie.name} (${goalie.player_id})`);

  // 5. Record Goaltender Stint (26 shots faced, 2 goals allowed, Win 'W')
  const { data: stintId, error: stErr } = await commClient.rpc("record_goalie_stint", {
    target_game: game.id,
    target_team_entry: game.home_entry_id,
    target_goalie: goalie.player_id,
    p_start: 1,
    c_start: 1200,
    p_end: 3,
    c_end: 0,
    empty_net: false,
    shots_faced: 26,
    goals_allowed: 2,
    goalie_decision: "W",
  });

  if (stErr) {
    console.error("❌ record_goalie_stint error:", stErr.message);
    return false;
  }
  console.log(`✓ Recorded goalie stint (ID: ${stintId})`);

  // 6. Query boxscore summary via anonClient (Public Fan Access)
  const { data: summary, error: sumErr } = await anonClient.rpc("get_game_shots_summary", {
    target_game: game.id,
  });

  if (sumErr) {
    console.error("❌ get_game_shots_summary RPC error:", sumErr.message);
    return false;
  }

  assert.ok(summary, "Expected summary data");
  const homeSummary = summary.period_shots.find((s) => s.team_entry_id === game.home_entry_id);
  const awaySummary = summary.period_shots.find((s) => s.team_entry_id === game.away_entry_id);

  assert.equal(homeSummary.total, 35, `Expected 35 home shots, got ${homeSummary.total}`);
  assert.equal(awaySummary.total, 26, `Expected 26 away shots, got ${awaySummary.total}`);
  console.log(`✓ Verified period shots aggregation: ${summary.home_name} (35 SOG) vs ${summary.away_name} (26 SOG)`);

  const goalieStat = summary.goalies.find((g) => g.stint_id === stintId);
  assert.ok(goalieStat, "Expected goalie appearance in summary");
  assert.equal(goalieStat.shots_against, 26);
  assert.equal(goalieStat.goals_against, 2);
  assert.equal(goalieStat.saves, 24);
  assert.equal(goalieStat.save_percentage, 92.3);
  assert.equal(goalieStat.decision, "W");
  console.log(`✓ Verified goalie metrics: ${goalieStat.player_name} — 26 SA, 2 GA, 24 SV (92.3% SV%), Decision: [W]`);

  // 7. Verify live route HTTP 200
  const liveRes = await fetch(`http://127.0.0.1:3000/schedule/${game.id}/live`);
  assert.equal(liveRes.status, 200, `Expected HTTP 200 from live game page, got ${liveRes.status}`);
  console.log(`✓ HTTP 200 OK from http://127.0.0.1:3000/schedule/${game.id}/live`);

  console.log("\n🎯 Detailed Shots, Saves & Goalie Change Tracking: ALL PASSED!");
  return true;
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

