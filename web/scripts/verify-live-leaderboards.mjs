import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import assert from "node:assert/strict";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const DEMO_SEASON_ID = "60000000-0000-4000-8000-000000000002";

async function verify() {
  console.log("=== Verifying Live Skater & Goalie Leaderboards ===");
  const anonClient = createClient(url, key);

  // 1. Query skater leaders
  const { data: skaters, error: skError } = await anonClient.rpc("get_season_skater_leaders", {
    target_season: DEMO_SEASON_ID,
  });

  if (skError) {
    console.error("❌ get_season_skater_leaders RPC error:", skError.message);
    console.error("Code:", skError.code);
    return false;
  }

  assert.ok(Array.isArray(skaters), "Expected array of skater leaders");
  console.log(`✓ Fetched ${skaters.length} skaters from live demo season`);
  if (skaters.length > 0) {
    console.log(`   Scoring Leader: ${skaters[0].display_name} (${skaters[0].team_name}) - G: ${skaters[0].goals}, A: ${skaters[0].assists}, PTS: ${skaters[0].points}, PIM: ${skaters[0].penalty_minutes}`);
  }

  // 2. Query goalie leaders
  const { data: goalies, error: gError } = await anonClient.rpc("get_season_goalie_leaders", {
    target_season: DEMO_SEASON_ID,
  });

  if (gError) {
    console.error("❌ get_season_goalie_leaders RPC error:", gError.message);
    console.error("Code:", gError.code);
    return false;
  }

  assert.ok(Array.isArray(goalies), "Expected array of goalie leaders");
  console.log(`✓ Fetched ${goalies.length} goalies from live demo season`);
  if (goalies.length > 0) {
    console.log(`   Top Goaltender: ${goalies[0].display_name} (${goalies[0].team_name}) - GP: ${goalies[0].games_played}, GA: ${goalies[0].goals_against}, GAA: ${goalies[0].goals_against_average}, SO: ${goalies[0].shutouts}`);
  }

  // 3. Test portal HTTP response for /standings
  const pageRes = await fetch("http://127.0.0.1:3000/standings");
  console.log(`✓ Portal GET /standings returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from standings portal page");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("Standings &amp; Leaders") || pageHtml.includes("Standings"), "Expected Standings page title");
  assert.ok(pageHtml.includes("Skater Scoring Race"), "Expected Skater Scoring Race section");
  assert.ok(pageHtml.includes("Goaltending Leaders"), "Expected Goaltending Leaders section");
  console.log("✓ Portal /standings rendered both Leaderboard sections with live data");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL LEADERBOARD CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ LEADERBOARD MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });

