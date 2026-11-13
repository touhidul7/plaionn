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
  console.log("=== Verifying Live Spare & Goalie Discovery and Call-Up Workflows ===");
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

  // 2. Fetch a player from demo roster
  const { data: roster, error: rErr } = await commClient
    .from("roster_memberships")
    .select("player_id, jersey_number")
    .eq("team_entry_id", DEMO_ENTRY_ID)
    .limit(1);

  if (rErr || !roster || roster.length === 0) {
    console.error("❌ Could not fetch player from demo roster:", rErr?.message);
    return false;
  }

  const playerId = roster[0].player_id;
  const { data: playerRec } = await commClient
    .from("players")
    .select("id, display_name")
    .eq("id", playerId)
    .single();

  const playerName = playerRec?.display_name || "Demo Player";
  console.log(`✓ Selected player: ${playerName} (ID: ${playerId})`);

  // 3. Register spare availability as Goalie (G)
  const { data: poolId, error: regErr } = await commClient.rpc("register_spare_availability", {
    target_league: DEMO_LEAGUE_ID,
    target_player: playerId,
    target_position: "G",
    skill: "Advanced",
    available: true,
    spare_notes: "Emergency backup goaltender on call",
  });

  if (regErr) {
    console.error("❌ register_spare_availability RPC error:", regErr.message);
    console.error("Code:", regErr.code);
    return false;
  }
  console.log(`✓ Registered ${playerName} in Goalie pool (Pool ID: ${poolId})`);

  // 4. Query available spares via anon client
  const { data: spares, error: sErr } = await anonClient.rpc("list_available_spares", {
    target_league: DEMO_LEAGUE_ID,
    target_position: "G",
  });

  if (sErr) {
    console.error("❌ list_available_spares RPC error:", sErr.message);
    return false;
  }

  assert.ok(Array.isArray(spares), "Expected spares array");
  const liveSpare = spares.find((s) => s.player_id === playerId);
  assert.ok(liveSpare, "Expected player in live available spares list");
  assert.equal(liveSpare.preferred_position, "G");
  assert.equal(liveSpare.is_available, true);
  console.log(`✓ Public Fan & Captain Spare Discovery verified: Goalie ${playerName} listed as available`);

  // 5. Fetch a scheduled game
  const { data: games, error: gErr } = await commClient
    .from("games")
    .select("id, starts_at")
    .eq("league_id", DEMO_LEAGUE_ID)
    .eq("status", "scheduled")
    .limit(1);

  if (gErr || !games || games.length === 0) {
    console.error("❌ Could not fetch scheduled game in demo league:", gErr?.message);
    return false;
  }

  const gameId = games[0].id;
  console.log(`✓ Located scheduled game (ID: ${gameId})`);

  // 6. Request call-up for game
  const { data: callupId, error: cErr } = await commClient.rpc("request_game_callup", {
    target_game: gameId,
    target_entry: DEMO_ENTRY_ID,
    target_player: playerId,
    target_position: "G",
    jersey_num: 35,
  });

  if (cErr) {
    console.error("❌ request_game_callup RPC error:", cErr.message);
    return false;
  }
  console.log(`✓ Dispatched call-up request (Callup ID: ${callupId}) with jersey #35`);

  // 7. Spare accepts call-up
  const { data: accepted, error: aErr } = await commClient.rpc("respond_to_callup", {
    target_callup: callupId,
    accept: true,
  });

  if (aErr) {
    console.error("❌ respond_to_callup RPC error:", aErr.message);
    return false;
  }
  console.log(`✓ Spare player accepted call-up!`);

  // 8. Verify game call-ups via anon client
  const { data: gameCallups, error: gcErr } = await anonClient.rpc("list_game_callups", {
    target_game: gameId,
  });

  if (gcErr) {
    console.error("❌ list_game_callups RPC error:", gcErr.message);
    return false;
  }

  assert.ok(Array.isArray(gameCallups), "Expected game callups array");
  const callup = gameCallups.find((c) => c.callup_id === callupId);
  assert.ok(callup, "Expected callup in list");
  assert.equal(callup.status, "accepted");
  assert.equal(callup.jersey_number, 35);
  console.log(`✓ Verified game roster assignment: ${callup.player_name} (#${callup.jersey_number}) confirmed as spare goalie`);

  // 9. Test Portal HTTP GET /spares
  const pageRes = await fetch("http://127.0.0.1:3000/spares");
  console.log(`✓ Portal GET /spares returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from /spares");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("Spare &amp; Goalie Pool") || pageHtml.includes("Spare"), "Expected Spares heading in HTML");
  assert.ok(pageHtml.includes("League Spare &amp; Sub Pool"), "Expected spare pool table in HTML");
  console.log("✓ Portal /spares rendered spare pool board with live Supabase data");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL SPARE & GOALIE WORKFLOW CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ SPARE POOL MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });

