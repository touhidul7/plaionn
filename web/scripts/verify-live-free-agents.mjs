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
  console.log("=== Verifying Live Free Agent & Team Tryouts Discovery ===");
  const anonClient = createClient(url, key);

  // 1. Authenticate as commissioner
  const commClient = createClient(url, key);
  const { data: authData, error: authErr } = await commClient.auth.signInWithPassword({
    email: COMMISSIONER_EMAIL,
    password: COMMISSIONER_PASSWORD,
  });

  if (authErr) {
    console.error("❌ Commissioner login failed:", authErr.message);
    return false;
  }
  const userId = authData.user.id;
  console.log(`✓ Commissioner authenticated (${COMMISSIONER_EMAIL})`);

  // 2. Fetch an existing player from demo league
  const { data: lpList, error: pErr } = await commClient
    .from("league_players")
    .select("player_id, players(id, display_name)")
    .eq("league_id", DEMO_LEAGUE_ID)
    .limit(5);

  if (pErr || !lpList || lpList.length === 0) {
    console.error("❌ Failed to query league players:", pErr?.message);
    return false;
  }

  const candidate = lpList[lpList.length - 1];
  const player = {
    id: candidate.player_id,
    display_name: candidate.players?.display_name || "Demo Player",
  };
  console.log(`✓ Using player: ${player.display_name} (${player.id})`);
  console.log(`✓ Using player: ${player.display_name} (${player.id})`);

  // 3. Register as Free Agent
  const { data: profileId, error: rErr } = await commClient.rpc("register_free_agent", {
    target_league: DEMO_LEAGUE_ID,
    target_player: player.id,
    target_position: "F",
    skill: "Competitive / Advanced",
    pref_division: null,
    agent_bio: "Fast two-way forward with junior experience seeking competitive roster.",
  });

  if (rErr) {
    console.error("❌ register_free_agent RPC error:", rErr.message);
    return false;
  }
  console.log(`✓ Registered free agent profile (ID: ${profileId})`);

  // 4. Post Team Vacancy for Northline HC
  const { data: vacancyId, error: vErr } = await commClient.rpc("post_team_vacancy", {
    target_entry: DEMO_ENTRY_ID,
    positions_array: ["F", "D"],
    vacancy_desc: "Northline HC seeks top-6 forward for playoff stretch.",
    open_spots: 2,
  });

  if (vErr) {
    console.error("❌ post_team_vacancy RPC error:", vErr.message);
    return false;
  }
  console.log(`✓ Posted team vacancy for Northline HC (ID: ${vacancyId})`);

  // 5. Query public listings via anon client
  const { data: faList, error: lfaErr } = await anonClient.rpc("list_free_agents", {
    target_league: DEMO_LEAGUE_ID,
  });
  if (lfaErr) {
    console.error("❌ list_free_agents RPC error:", lfaErr.message);
    return false;
  }
  const myProfile = faList.find((p) => p.player_id === player.id);
  assert.ok(myProfile, "Expected registered free agent in public list");
  assert.equal(myProfile.status, "seeking");
  console.log(`✓ Verified public free agent listing: ${myProfile.player_name} (${myProfile.preferred_position})`);

  const { data: vacList, error: lvacErr } = await anonClient.rpc("list_team_vacancies", {
    target_league: DEMO_LEAGUE_ID,
  });
  if (lvacErr) {
    console.error("❌ list_team_vacancies RPC error:", lvacErr.message);
    return false;
  }
  const myVacancy = vacList.find((v) => v.vacancy_id === vacancyId);
  assert.ok(myVacancy, "Expected posted vacancy in public list");
  assert.equal(myVacancy.spots_available, 2);
  console.log(`✓ Verified public team vacancy: ${myVacancy.team_name} seeking [${myVacancy.needed_positions.join(", ")}]`);

  // 6. Submit application to vacancy
  const { data: appId, error: appErr } = await commClient.rpc("apply_to_vacancy", {
    target_vacancy: vacancyId,
    target_player: player.id,
    app_message: "Ready to skate Thursday, let me know if there is a tryout.",
  });
  if (appErr) {
    console.error("❌ apply_to_vacancy RPC error:", appErr.message);
    return false;
  }
  console.log(`✓ Submitted application to Northline HC (ID: ${appId})`);

  // 7. Commissioner reviews & accepts application
  const { error: revErr } = await commClient.rpc("review_vacancy_application", {
    target_application: appId,
    accept: true,
    assigned_jersey: 98,
  });
  if (revErr) {
    console.error("❌ review_vacancy_application RPC error:", revErr.message);
    return false;
  }
  console.log("✓ Reviewed and accepted application with jersey #98");

  // 8. Verify automated roster placement & updated status
  const { data: updatedProfile } = await anonClient.rpc("list_free_agents", {
    target_league: DEMO_LEAGUE_ID,
  });
  const placedAgent = updatedProfile.find((p) => p.player_id === player.id);
  assert.equal(placedAgent.status, "placed", "Expected free agent status to transition to 'placed'");
  console.log("✓ Verified free agent profile transitioned to status: 'placed'");

  const { data: rosterEntry } = await commClient
    .from("roster_memberships")
    .select("team_entry_id, player_id, jersey_number, status")
    .eq("team_entry_id", DEMO_ENTRY_ID)
    .eq("player_id", player.id)
    .single();

  assert.ok(rosterEntry, "Expected player in roster_memberships");
  assert.equal(rosterEntry.jersey_number, 98);
  assert.equal(rosterEntry.status, "active");
  console.log("✓ Verified automated roster insertion: Northline HC active roster, Jersey #98");

  // 9. Verify HTTP 200 on portal route /free-agents
  const res = await fetch("http://127.0.0.1:3000/free-agents");
  assert.equal(res.status, 200, `Expected HTTP 200 from /free-agents, got ${res.status}`);
  console.log("✓ HTTP 200 OK from http://127.0.0.1:3000/free-agents");

  // Cleanup: remove from roster so demo team stays pristine
  await commClient
    .from("roster_memberships")
    .delete()
    .eq("team_entry_id", DEMO_ENTRY_ID)
    .eq("player_id", player.id);

  console.log("\n🎯 Free Agent & Team Discovery Live Verification: ALL PASSED!");
  return true;
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
