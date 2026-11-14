"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";

export interface OfficialActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function upsertOfficialProfileAction(
  prevState: OfficialActionState,
  formData: FormData
): Promise<OfficialActionState> {
  const targetUserId = formData.get("userId") as string;
  const fullName = formData.get("fullName") as string;
  const certLevel = formData.get("certLevel") as string;
  const certExpiry = (formData.get("certExpiry") as string) || null;
  const refFeeDollars = parseFloat((formData.get("refFee") as string) || "45");
  const tkFeeDollars = parseFloat((formData.get("timekeeperFee") as string) || "30");
  const isActive = formData.get("isActive") === "on";

  if (!targetUserId || !fullName || !certLevel) {
    return { status: "error", message: "Missing required official profile fields" };
  }

  const { supabase, league, canManage } = await getLeagueContext();
  if (!canManage) {
    return { status: "error", message: "Commissioner access required" };
  }

  const refFeeCents = Math.round(refFeeDollars * 100);
  const tkFeeCents = Math.round(tkFeeDollars * 100);

  const { error } = await supabase.rpc("upsert_official_profile", {
    target_league: league.id,
    target_user: targetUserId,
    official_name: fullName,
    cert_level: certLevel,
    cert_expiry: certExpiry,
    ref_fee: refFeeCents,
    timekeeper_fee: tkFeeCents,
    active: isActive,
  });

  if (error) {
    return { status: "error", message: error.message || "Could not save official rate card" };
  }

  revalidatePath("/league/officials");
  return { status: "success", message: `Updated rate card for ${fullName}` };
}

export async function markOfficialPayoutAction(
  prevState: OfficialActionState,
  formData: FormData
): Promise<OfficialActionState> {
  const targetUserId = formData.get("userId") as string;
  const paymentRef = (formData.get("paymentRef") as string) || "Manual Payout";

  if (!targetUserId) {
    return { status: "error", message: "Missing official user ID" };
  }

  const { supabase, league, canManage } = await getLeagueContext();
  if (!canManage) {
    return { status: "error", message: "Commissioner access required" };
  }

  const { data, error } = await supabase.rpc("mark_official_payout", {
    target_league: league.id,
    target_user: targetUserId,
    payment_ref: paymentRef,
  });

  if (error) {
    return { status: "error", message: error.message || "Failed to mark payout as paid" };
  }

  revalidatePath("/league/officials");
  return { status: "success", message: `Successfully marked ${data} games as paid` };
}
