import { createClient } from "@supabase/supabase-js";
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

const DEMO_LEAGUE_ID = "60000000-0000-4000-8000-000000000001";
const DEMO_SEASON_ID = "60000000-0000-4000-8000-000000000002";
const NORTHLINE_ENTRY_ID = "60000000-0000-4000-8000-000000000021";

async function verify() {
  console.log("=== STEP 1: Live Public / Anonymous Fan Verification ===");
  const anonClient = createClient(url, key);

  // 1a. Test get_public_league_overview
  const { data: overview, error: ovError } = await anonClient.rpc("get_public_league_overview", {
    target_league: DEMO_LEAGUE_ID,
  });
  assert.equal(ovError, null, "Public overview failed: " + ovError?.message);
  console.log("✓ Public league overview: Found league", overview?.[0]?.league_name);
  assert.ok(overview?.[0]?.seasons?.length > 0, "Expected seasons in public overview");
  assert.ok(overview?.[0]?.teams?.length > 0, "Expected teams in public overview");

  // 1b. Test get_public_schedule
  const { data: schedule, error: schError } = await anonClient.rpc("get_public_schedule", {
    target_league: DEMO_LEAGUE_ID,
  });
  assert.equal(schError, null, "Public schedule failed: " + schError?.message);
  console.log("✓ Public schedule: Found", schedule?.length, "published fixtures");

  // 1c. Test get_season_standings anonymously
  const { data: standings, error: stdError } = await anonClient.rpc("get_season_standings", {
    target_season: DEMO_SEASON_ID,
  });
  assert.equal(stdError, null, "Public standings failed: " + stdError?.message);
  console.log("✓ Public standings: Calculated table for", standings?.length, "teams");
  if (standings?.length) {
    console.log("   Rank 1:", standings[0].team_name, "- Points:", standings[0].points, "- GD:", standings[0].goal_difference);
  }

  console.log("\n=== STEP 2: Live Authenticated Billing & Invoicing Verification ===");
  let cookieHeader = "";
  const authClient = createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        cookieHeader = cookies.map((c) => c.name + "=" + c.value).join("; ");
      },
    },
  });

  const authRes = await authClient.auth.signInWithPassword({
    email: "reviewer_test_user@plaionn.com",
    password: "TestPassword123!@#",
  });
  assert.equal(authRes.error, null, "Sign-in failed: " + authRes.error?.message);
  console.log("✓ Signed in as commissioner:", authRes.data.user.email);

  // 2a. Create team invoice for Northline HC ($1,200.00 CAD = 120,000 cents)
  const { data: invoiceId, error: invError } = await authClient.rpc("create_team_invoice", {
    target_entry: NORTHLINE_ENTRY_ID,
    invoice_title: "2026-2027 Team Registration Fee",
    total_cents: 120000,
    invoice_due_date: "2026-12-15",
  });
  assert.equal(invError, null, "Create team invoice failed: " + invError?.message);
  console.log("✓ Created invoice:", invoiceId, "for $1,200.00 CAD");

  // 2b. Record partial payment ($500.00 CAD via e-Transfer)
  const { data: paymentRev, error: payError } = await authClient.rpc("record_invoice_payment", {
    target_invoice: invoiceId,
    payment_cents: 50000,
    pay_method: "etransfer",
    ref_number: "ETR-2026-00129",
    payment_notes: "Initial deposit received via Interac e-Transfer",
  });
  assert.equal(payError, null, "Record invoice payment failed: " + payError?.message);
  console.log("✓ Recorded $500.00 CAD e-Transfer (Invoice Revision:", paymentRev, ")");

  // 2c. Verify overpayment is blocked
  const { error: overpayError } = await authClient.rpc("record_invoice_payment", {
    target_invoice: invoiceId,
    payment_cents: 80000, // Balance is only 70000!
    pay_method: "cash",
    ref_number: "",
    payment_notes: "Overpayment attempt",
  });
  assert.ok(overpayError !== null, "Expected overpayment to be rejected");
  console.log("✓ Overpayment protection verified: rejected with code", overpayError.code, "(" + overpayError.message + ")");

  // 2d. Check team billing summary
  const { data: summary, error: sumError } = await authClient.rpc("get_team_billing_summary", {
    target_entry: NORTHLINE_ENTRY_ID,
  });
  assert.equal(sumError, null, "Billing summary failed: " + sumError?.message);
  const row = summary?.[0];
  console.log("✓ Team billing summary:");
  console.log("   Total Billed: $" + (Number(row.total_billed_cents) / 100).toFixed(2), row.currency);
  console.log("   Total Paid:   $" + (Number(row.total_paid_cents) / 100).toFixed(2), row.currency);
  console.log("   Balance Due:  $" + (Number(row.balance_cents) / 100).toFixed(2), row.currency);
  assert.equal(Number(row.balance_cents), 70000, "Expected balance to equal 70,000 cents ($700.00)");

  console.log("\n=== STEP 3: Live Portal UI Route Checks ===");
  // 3a. Guest /schedule
  const guestSched = await fetch("http://127.0.0.1:3000/schedule");
  console.log("✓ Guest /schedule returned HTTP", guestSched.status);
  assert.equal(guestSched.status, 200);

  // 3b. Guest /standings
  const guestStd = await fetch("http://127.0.0.1:3000/standings");
  console.log("✓ Guest /standings returned HTTP", guestStd.status);
  assert.equal(guestStd.status, 200);

  // 3c. Commissioner /league/billing
  const commBilling = await fetch("http://127.0.0.1:3000/league/billing", {
    headers: { Cookie: cookieHeader },
  });
  console.log("✓ Commissioner /league/billing returned HTTP", commBilling.status);
  assert.equal(commBilling.status, 200);
  const billingHtml = await commBilling.text();
  assert.ok(billingHtml.includes("2026-2027 Team Registration Fee") || billingHtml.includes("Northline HC"), "Invoice should render in HTML");

  console.log("\nALL LIVE PRODUCTION WORKFLOWS VERIFIED SUCCESSFULLY!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
