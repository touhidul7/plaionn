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
const COMMISSIONER_EMAIL = "reviewer_test_user@plaionn.com";
const COMMISSIONER_PASSWORD = "TestPassword123!@#";

async function verify() {
  console.log("=== Verifying Live Playoff Brackets & Tournament Engine ===");
  const anonClient = createClient(url, key);

  // 1. Sign in as commissioner to access league divisions and seed bracket
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

  // 2. Fetch demo division
  const { data: divisions, error: divErr } = await commClient
    .from("divisions")
    .select("id, name")
    .eq("season_id", DEMO_SEASON_ID)
    .limit(1);

  if (divErr || !divisions || divisions.length === 0) {
    console.error("❌ Could not fetch divisions for demo season:", divErr?.message);
    return false;
  }

  const divisionId = divisions[0].id;
  console.log(`✓ Located demo division: "${divisions[0].name}" (${divisionId})`);

  // 3. Call generate_playoff_bracket with 2 teams (matches demo division team count)
  const { data: tournamentId, error: genErr } = await commClient.rpc("generate_playoff_bracket", {
    target_division: divisionId,
    tournament_name: "PLAIONN Championship Cup",
    playoff_format: "single_elimination",
    team_count: 2,
  });

  if (genErr) {
    console.error("❌ generate_playoff_bracket RPC error:", genErr.message);
    console.error("Code:", genErr.code);
    return false;
  }

  console.log(`✓ Generated 2-team playoff bracket! Tournament ID: ${tournamentId}`);

  // 4. Query playoff bracket via anon client (Public Fan Access)
  const { data: bracketData, error: bErr } = await anonClient.rpc("get_division_playoff_bracket", {
    target_division: divisionId,
  });

  if (bErr) {
    console.error("❌ get_division_playoff_bracket RPC error:", bErr.message);
    return false;
  }

  assert.ok(Array.isArray(bracketData) && bracketData.length > 0, "Expected bracket data for division");
  const tournament = bracketData[0];
  console.log(`✓ Public Fan Bracket loaded: "${tournament.name}" (${tournament.format}, ${tournament.team_count} teams)`);

  const series = tournament.series;
  assert.equal(series.length, 1, "Expected 1 championship series for a 2-team bracket");
  console.log(`✓ Bracket series structure validated: Championship Final`);
  console.log(`   Final: #${series[0].high_seed_rank} ${series[0].high_seed_name} vs #${series[0].low_seed_rank} ${series[0].low_seed_name}`);

  // 5. Test updating series score and declaring winner
  const finalSeries = series[0];
  const { error: updateErr } = await commClient
    .from("playoff_series")
    .update({
      high_seed_wins: 1,
      winner_entry_id: finalSeries.high_seed_entry_id,
      status: "completed",
    })
    .eq("id", finalSeries.id);

  if (updateErr) {
    console.error("❌ Failed to update final series score:", updateErr.message);
    return false;
  }

  console.log(`✓ Declared Champion: ${finalSeries.high_seed_name} (High Seed)!`);

  // 6. Test Portal HTTP GET /playoffs
  const pageRes = await fetch("http://127.0.0.1:3000/playoffs");
  console.log(`✓ Portal GET /playoffs returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from /playoffs");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("Playoff Tournament Brackets"), "Expected Playoff Tournament Brackets heading in page");
  assert.ok(pageHtml.includes("PLAIONN Championship Cup"), "Expected tournament name in page HTML");
  console.log("✓ Portal /playoffs rendered bracket tree successfully with live Supabase data");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL PLAYOFF TOURNAMENT CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ PLAYOFF BRACKET MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });
