"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import { createInvoiceSchema, recordPaymentSchema } from "@/lib/billing-schema";

export type BillingActionState = {
  error: boolean;
  message: string;
};

export async function createTeamInvoiceAction(
  _prev: BillingActionState,
  form: FormData
): Promise<BillingActionState> {
  const parsed = createInvoiceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      error: true,
      message: parsed.error.issues[0]?.message ?? "Invalid invoice details.",
    };
  }

  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { error: true, message: "Commissioner access required." };
  }

  const { error } = await supabase.rpc("create_team_invoice", {
    target_entry: parsed.data.team_entry_id,
    invoice_title: parsed.data.title,
    total_cents: parsed.data.amount_cents,
    invoice_due_date: parsed.data.due_date,
  });

  if (error) {
    return {
      error: true,
      message: error.message ?? "Could not issue invoice. Check team entry and permissions.",
    };
  }

  revalidatePath("/league/billing");
  revalidatePath("/teams", "layout");
  return { error: false, message: "Invoice issued successfully." };
}

export async function recordInvoicePaymentAction(
  _prev: BillingActionState,
  form: FormData
): Promise<BillingActionState> {
  const parsed = recordPaymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      error: true,
      message: parsed.error.issues[0]?.message ?? "Invalid payment details.",
    };
  }

  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { error: true, message: "Commissioner access required." };
  }

  const { error } = await supabase.rpc("record_invoice_payment", {
    target_invoice: parsed.data.invoice_id,
    payment_cents: parsed.data.amount_cents,
    pay_method: parsed.data.payment_method,
    ref_number: parsed.data.reference_number,
    payment_notes: parsed.data.notes,
  });

  if (error) {
    return {
      error: true,
      message: error.message ?? "Payment recording failed. Verify balance and status.",
    };
  }

  revalidatePath("/league/billing");
  revalidatePath("/teams", "layout");
  return { error: false, message: "Payment recorded and balance reconciled." };
}

