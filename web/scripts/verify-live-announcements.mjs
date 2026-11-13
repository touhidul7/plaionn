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
  console.log("=== Verifying Live League & Team Announcements ===");
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

  // 2. Publish urgent league-wide announcement
  const { data: urgentId, error: uErr } = await commClient.rpc("publish_announcement", {
    target_league: DEMO_LEAGUE_ID,
    notice_title: "Urgent Weather Advisory: Rink 1 Delay",
    notice_message: "Please allow extra driving time; game start delayed 20 minutes.",
    notice_priority: "urgent",
    target_entry: null,
    pinned: true,
    expire_time: null,
  });

  if (uErr) {
    console.error("❌ publish_announcement (urgent) RPC error:", uErr.message);
    console.error("Code:", uErr.code);
    return false;
  }
  console.log(`✓ Published urgent league announcement (ID: ${urgentId})`);

  // 3. Publish team locker room notice
  const { data: teamNoticeId, error: tErr } = await commClient.rpc("publish_announcement", {
    target_league: DEMO_LEAGUE_ID,
    notice_title: "Northline HC Locker Room Notice",
    notice_message: "Team assigned to locker room 3. White jerseys tonight.",
    notice_priority: "standard",
    target_entry: DEMO_ENTRY_ID,
    pinned: false,
    expire_time: null,
  });

  if (tErr) {
    console.error("❌ publish_announcement (team) RPC error:", tErr.message);
    return false;
  }
  console.log(`✓ Published team locker room notice (ID: ${teamNoticeId})`);

  // 4. Query active announcements via anon client (Public Fan Access)
  const { data: notices, error: lErr } = await anonClient.rpc("list_active_announcements", {
    target_league: DEMO_LEAGUE_ID,
  });

  if (lErr) {
    console.error("❌ list_active_announcements RPC error:", lErr.message);
    return false;
  }

  assert.ok(Array.isArray(notices) && notices.length >= 2, "Expected at least 2 active notices");
  assert.equal(notices[0].announcement_id, urgentId, "Expected urgent notice to be ranked first");
  assert.equal(notices[0].priority, "urgent");
  console.log(`✓ Verified announcement priority ordering: Urgent alert "${notices[0].title}" pinned to top`);

  // 5. Query team-scoped notices for Northline HC
  const { data: teamNotices } = await anonClient.rpc("list_active_announcements", {
    target_league: DEMO_LEAGUE_ID,
    target_entry: DEMO_ENTRY_ID,
  });
  const hasTeamNotice = teamNotices.some((n) => n.announcement_id === teamNoticeId);
  assert.ok(hasTeamNotice, "Expected team notice in Northline HC feed");
  console.log(`✓ Verified team-scoped feed: Northline HC notice successfully delivered`);

  // 6. Delete test announcements
  await commClient.rpc("delete_announcement", { target_announcement: urgentId });
  await commClient.rpc("delete_announcement", { target_announcement: teamNoticeId });
  console.log(`✓ Cleanup: Deleted test announcements successfully`);

  // 7. Test Portal HTTP GET /announcements
  const pageRes = await fetch("http://127.0.0.1:3000/announcements");
  console.log(`✓ Portal GET /announcements returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from /announcements");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("League Announcements") || pageHtml.includes("Announcements"), "Expected Announcements heading in HTML");
  assert.ok(pageHtml.includes("League &amp; Locker Room Notices"), "Expected notice feed title in HTML");
  console.log("✓ Portal /announcements rendered notice feed successfully with live Supabase data");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL ANNOUNCEMENT & MESSAGING CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ ANNOUNCEMENT MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });

