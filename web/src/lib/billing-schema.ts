import { z } from "zod";

const amountDollars = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid dollar amount (e.g. 150.00).")
  .transform((val) => Math.round(Number(val) * 100));

export const createInvoiceSchema = z.object({
  team_entry_id: z.uuid("Select a valid team entry."),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(150),
  amount_cents: amountDollars,
  due_date: z.string().optional().transform((val) => val || null),
});

export const recordPaymentSchema = z.object({
  invoice_id: z.uuid("Select a valid invoice."),
  amount_cents: amountDollars,
  payment_method: z.enum(["etransfer", "cash", "cheque", "credit_card", "stripe"]),
  reference_number: z.string().trim().max(100).optional().transform((val) => val || ""),
  notes: z.string().trim().max(500).optional().transform((val) => val || ""),
});

export type InvoiceRow = {
  id: string;
  season_id: string;
  recipient_type: "team" | "player";
  team_entry_id: string | null;
  player_id: string | null;
  title: string;
  amount_cents: number;
  amount_paid_cents: number;
  currency: string;
  due_date: string | null;
  status: "draft" | "issued" | "partially_paid" | "paid" | "void";
  revision: number;
  created_at: string;
};

export type TeamBillingSummary = {
  total_billed_cents: number;
  total_paid_cents: number;
  balance_cents: number;
  invoice_count: number;
  currency: string;
};

