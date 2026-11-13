import { createServerClient } from "@supabase/ssr";
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

const GAME_ID = "60000000-0000-4000-8000-000000000006";
const NORTHLINE_ENTRY_ID = "60000000-0000-4000-8000-000000000021";

async function verify() {
  console.log("=== Verifying Game Attendance & Player RSVP ===");

  let sessionCookies = [];
  const authClient = createServerClient(url, key, {
    cookies: {
      getAll: () => sessionCookies,
      setAll: (cookies) => {
        sessionCookies = cookies;
      },
    },
  });

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: "reviewer_test_user@plaionn.com",
    password: "TestPassword123!@#",
  });
  assert.equal(authError, null, "Sign in failed: " + authError?.message);
  console.log("✓ Authenticated as reviewer/commissioner:", authData.user.email);

  // 1. List attendance for Northline HC
  const { data: attendanceList, error: listError } = await authClient.rpc("list_game_attendance", {
    target_game: GAME_ID,
    target_entry: NORTHLINE_ENTRY_ID,
  });

  if (listError) {
    console.error("❌ list_game_attendance RPC error:", listError.message);
    console.error("Code:", listError.code);
    return false;
  }

  assert.ok(Array.isArray(attendanceList), "Expected attendance list array");
  console.log(`✓ Fetched attendance for Northline HC: ${attendanceList.length} players found`);
  assert.ok(attendanceList.length > 0, "Expected at least 1 player on roster");

  const targetPlayer = attendanceList[0];
  console.log(`   Testing RSVP on player: ${targetPlayer.display_name} (#${targetPlayer.jersey_number ?? "—"}) [${targetPlayer.player_position}]`);

  // 2. Submit RSVP as 'attending'
  const { data: rsvp1, error: rsvp1Err } = await authClient.rpc("save_game_rsvp", {
    target_game: GAME_ID,
    target_player: targetPlayer.player_id,
    rsvp_status: "attending",
    rsvp_note: "Confirmed via automated verification",
  });
  assert.equal(rsvp1Err, null, "save_game_rsvp attending failed: " + rsvp1Err?.message);
  console.log("✓ Submitted RSVP as ATTENDING:", rsvp1?.status);

  // 3. Update RSVP as 'tentative' (idempotent upsert)
  const { data: rsvp2, error: rsvp2Err } = await authClient.rpc("save_game_rsvp", {
    target_game: GAME_ID,
    target_player: targetPlayer.player_id,
    rsvp_status: "tentative",
    rsvp_note: "Running 10 mins late from work",
  });
  assert.equal(rsvp2Err, null, "save_game_rsvp tentative failed: " + rsvp2Err?.message);
  console.log("✓ Updated RSVP to TENTATIVE:", rsvp2?.status, "- Note:", rsvp2?.note);

  // 4. Verify updated attendance list reflects status and note
  const { data: refreshedList, error: refError } = await authClient.rpc("list_game_attendance", {
    target_game: GAME_ID,
    target_entry: NORTHLINE_ENTRY_ID,
  });
  assert.equal(refError, null, "Refresh attendance list failed: " + refError?.message);
  const updatedPlayer = refreshedList.find((p) => p.player_id === targetPlayer.player_id);
  assert.equal(updatedPlayer?.rsvp_status, "tentative", "Expected rsvp_status to be 'tentative'");
  assert.equal(updatedPlayer?.note, "Running 10 mins late from work", "Expected note to match");
  console.log("✓ Live headcount state confirmed from database");

  // 5. Test portal HTTP response for RSVP page
  const cookieHeader = sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const pageRes = await fetch(`http://127.0.0.1:3000/schedule/${GAME_ID}/rsvp`, {
    headers: { Cookie: cookieHeader },
  });
  console.log(`✓ Portal GET /schedule/${GAME_ID}/rsvp returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from RSVP portal page");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("Roster Availability") || pageHtml.includes("GAME RSVP"), "Expected RSVP page content in HTML");
  console.log("✓ Portal RSVP page rendered successfully with live data");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL ATTENDANCE & RSVP CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ ATTENDANCE MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });

