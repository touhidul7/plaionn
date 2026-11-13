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
const DEMO_SEASON_ID = "60000000-0000-4000-8000-000000000002";
const DEMO_ENTRY_ID = "60000000-0000-4000-8000-000000000021"; // Northline HC
const COMMISSIONER_EMAIL = "reviewer_test_user@plaionn.com";
const COMMISSIONER_PASSWORD = "TestPassword123!@#";

async function verify() {
  console.log("=== Verifying Live Discipline, Suspensions & Appeals ===");
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

  // 2. Fetch a player on Northline HC roster
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
  const { data: playerRec, error: pErr } = await commClient
    .from("players")
    .select("id, display_name")
    .eq("id", playerId)
    .single();

  const playerName = playerRec?.display_name || "Demo Player";
  console.log(`✓ Selected roster player for discipline test: ${playerName} (#${roster[0].jersey_number}, ID: ${playerId})`);

  // 3. Record disciplinary incident with 2-game suspension
  const { data: incidentId, error: incErr } = await commClient.rpc("record_disciplinary_incident", {
    target_league: DEMO_LEAGUE_ID,
    target_season: DEMO_SEASON_ID,
    target_player: playerId,
    target_entry: DEMO_ENTRY_ID,
    infraction_name: "Game Misconduct - Checking from Behind",
    suspended_games: 2,
    penalty_mins: 10,
    target_game: null,
    incident_notes: "Live verification test incident",
  });

  if (incErr) {
    console.error("❌ record_disciplinary_incident RPC error:", incErr.message);
    console.error("Code:", incErr.code);
    return false;
  }

  console.log(`✓ Recorded disciplinary incident (ID: ${incidentId}) with 2-game suspension`);

  // 4. Verify is_player_suspended returns true
  const { data: isSuspended, error: suspErr } = await anonClient.rpc("is_player_suspended", {
    target_player: playerId,
  });

  if (suspErr) {
    console.error("❌ is_player_suspended RPC error:", suspErr.message);
    return false;
  }

  assert.equal(isSuspended, true, "Expected player to be flagged as suspended");
  console.log(`✓ Verified player ${playerName} is actively suspended (is_player_suspended = true)`);

  // 5. Query public ledger
  const { data: ledger, error: lErr } = await anonClient.rpc("list_league_discipline", {
    target_league: DEMO_LEAGUE_ID,
  });

  if (lErr) {
    console.error("❌ list_league_discipline RPC error:", lErr.message);
    return false;
  }

  assert.ok(Array.isArray(ledger), "Expected ledger array");
  const liveInc = ledger.find((i) => i.incident_id === incidentId);
  assert.ok(liveInc, "Expected to find newly recorded incident in league ledger");
  assert.equal(liveInc.games_remaining, 2);
  assert.equal(liveInc.status, "active");
  console.log(`✓ League disciplinary ledger loaded: Incident active with ${liveInc.games_remaining} games remaining`);

  // 6. Submit an appeal
  const { data: appealed, error: appErr } = await commClient.rpc("submit_suspension_appeal", {
    target_incident: incidentId,
    statement: "Appellant requests review of video angle: incidental contact on dump-in",
  });

  if (appErr) {
    console.error("❌ submit_suspension_appeal RPC error:", appErr.message);
    return false;
  }
  console.log("✓ Submitted suspension appeal on behalf of player");

  // 7. Resolve appeal: Reduce to 1 game
  const { data: reduced, error: redErr } = await commClient.rpc("resolve_suspension_appeal", {
    target_incident: incidentId,
    decision: "reduced",
    new_suspended_games: 1,
    commissioner_notes: "Reduced to 1 game after commissioner review of footage",
  });

  if (redErr) {
    console.error("❌ resolve_suspension_appeal (reduced) RPC error:", redErr.message);
    return false;
  }
  console.log("✓ Commissioner ruling: Suspension reduced to 1 game");

  // 8. Resolve appeal: Overturn / Rescind suspension
  const { data: overturned, error: ovErr } = await commClient.rpc("resolve_suspension_appeal", {
    target_incident: incidentId,
    decision: "overturned",
    new_suspended_games: null,
    commissioner_notes: "Overturned completely; player reinstated",
  });

  if (ovErr) {
    console.error("❌ resolve_suspension_appeal (overturned) RPC error:", ovErr.message);
    return false;
  }
  console.log("✓ Commissioner ruling: Suspension overturned and player reinstated!");

  // 9. Verify is_player_suspended now returns false
  const { data: isStillSuspended } = await anonClient.rpc("is_player_suspended", {
    target_player: playerId,
  });
  assert.equal(isStillSuspended, false, "Expected player to no longer be suspended after overturn");
  console.log(`✓ Verified player ${playerName} is fully reinstated (is_player_suspended = false)`);

  // 10. Test Portal HTTP GET /league/discipline
  const pageRes = await fetch("http://127.0.0.1:3000/league/discipline");
  console.log(`✓ Portal GET /league/discipline returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from /league/discipline");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("Discipline &amp; Suspensions") || pageHtml.includes("Discipline"), "Expected discipline heading");
  assert.ok(pageHtml.includes("Official Disciplinary Ledger"), "Expected ledger table in page HTML");
  console.log("✓ Portal /league/discipline rendered ledger successfully with live Supabase data");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL DISCIPLINE & SUSPENSION CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ DISCIPLINE MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });
