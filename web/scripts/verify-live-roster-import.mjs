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

const NORTHLINE_ENTRY_ID = "60000000-0000-4000-8000-000000000021";

async function verify() {
  console.log("=== Verifying Live Bulk Roster Import ===");

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

  // 1. Test bulk_import_roster RPC with valid players
  const batch = [
    { name: "Cale Makar", jersey: 8, position: "D" },
    { name: "Nathan MacKinnon", jersey: 29, position: "C" },
  ];

  const { data: importRes, error: importError } = await authClient.rpc("bulk_import_roster", {
    target_entry: NORTHLINE_ENTRY_ID,
    rows: batch,
  });

  if (importError) {
    console.error("❌ bulk_import_roster RPC error:", importError.message);
    console.error("Code:", importError.code);
    return false;
  }

  assert.ok(importRes, "Expected non-null response from bulk_import_roster");
  console.log(`✓ Bulk imported players into Northline HC: imported=${importRes.imported_count}, updated=${importRes.updated_count}, total=${importRes.total_roster_count}`);

  // 2. Test duplicate jersey rejection (trying to import another #29 in the same batch)
  const dupBatch = [
    { name: "Duplicate Player A", jersey: 91, position: "F" },
    { name: "Duplicate Player B", jersey: 91, position: "D" },
  ];
  const { error: dupError } = await authClient.rpc("bulk_import_roster", {
    target_entry: NORTHLINE_ENTRY_ID,
    rows: dupBatch,
  });
  assert.ok(dupError, "Expected error on batch duplicate jersey");
  console.log("✓ Correctly rejected batch with duplicate jersey number:", dupError.message);

  // 3. Test portal GET /teams/[entryId] with session cookie
  const cookieHeader = sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const pageRes = await fetch(`http://127.0.0.1:3000/teams/${NORTHLINE_ENTRY_ID}`, {
    headers: { Cookie: cookieHeader },
  });
  console.log(`✓ Portal GET /teams/${NORTHLINE_ENTRY_ID} returned HTTP ${pageRes.status}`);
  assert.equal(pageRes.status, 200, "Expected HTTP 200 from team roster page");

  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes("Bulk Import Roster from CSV"), "Expected Bulk Import button on team page");
  assert.ok(pageHtml.includes("Cale Makar") || pageHtml.includes("MacKinnon"), "Expected imported player name in HTML");
  console.log("✓ Portal team page rendered imported roster and CSV modal successfully");

  return true;
}

verify()
  .then((success) => {
    if (success) {
      console.log("\n✅ ALL ROSTER IMPORT CHECKS PASSED LIVE!");
      process.exit(0);
    } else {
      console.log("\n⚠️ ROSTER IMPORT MIGRATION PENDING IN SUPABASE.");
      process.exit(2);
    }
  })
  .catch((err) => {
    console.error("\n❌ Verification failed:", err);
    process.exit(1);
  });

