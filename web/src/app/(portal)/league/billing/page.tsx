import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  CreateInvoiceForm,
  RecordPaymentForm,
  InvoicesTable,
} from "@/components/billing-forms";
import type { InvoiceRow } from "@/lib/billing-schema";

export const dynamic = "force-dynamic";

export default async function LeagueBillingPage() {
  const data = await getLeagueData();
  const { supabase, league, canManage } = await getLeagueContext();

  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>Commissioner access required</h1>
        <p>Billing and financial tracking are restricted to league administrators.</p>
        <Link href="/league" className="button">
          Back to League HQ
        </Link>
      </section>
    );
  }

  const { data: invoicesData, error } = await supabase
    .from("league_invoices")
    .select("*")
    .eq("league_id", league.id)
    .order("created_at", { ascending: false });

  const invoices: InvoiceRow[] = (invoicesData as InvoiceRow[]) ?? [];

  const teamMap = new Map(data.teams.map((t) => [t.entry_id, t.name]));

  const entryOptions = data.teams.map((t) => ({
    id: t.entry_id,
    label: `${t.name} (${t.division_name})`,
  }));

  const totalBilledCents = invoices
    .filter((i) => i.status !== "void")
    .reduce((sum, i) => sum + i.amount_cents, 0);

  const totalPaidCents = invoices
    .filter((i) => i.status !== "void")
    .reduce((sum, i) => sum + i.amount_paid_cents, 0);

  const outstandingCents = totalBilledCents - totalPaidCents;
  const collectionRate = totalBilledCents > 0
    ? Math.round((totalPaidCents / totalBilledCents) * 100)
    : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEAGUE FINANCE & COLLECTIONS</p>
          <h1>Billing & Invoices</h1>
          <p>{league.name} · Track team fees, collections, and offline reconciliation</p>
        </div>
        <Link href="/league" className="button">
          Back to League HQ
        </Link>
      </div>

      <div className="metrics">
        <article className="panel">
          <p>Total Billed</p>
          <strong>${(totalBilledCents / 100).toFixed(2)}</strong>
          <span>Across all active invoices</span>
        </article>

        <article className="panel">
          <p>Total Collected</p>
          <strong style={{ color: "var(--lime)" }}>${(totalPaidCents / 100).toFixed(2)}</strong>
          <span>Reconciled payments</span>
        </article>

        <article className="panel">
          <p>Outstanding</p>
          <strong style={{ color: outstandingCents > 0 ? "#ffd27a" : "inherit" }}>
            ${(outstandingCents / 100).toFixed(2)}
          </strong>
          <span>Unpaid team balance</span>
        </article>

        <article className="panel">
          <p>Collection Rate</p>
          <strong>{collectionRate}%</strong>
          <span>Payment progress</span>
        </article>
      </div>

      {error ? (
        <section className="panel" style={{ marginTop: "24px" }}>
          <h2>Billing records unavailable</h2>
          <p>
            Please apply migration <code>202611160002_billing_and_invoices.sql</code> in the Supabase
            SQL Editor to enable financial tracking.
          </p>
        </section>
      ) : (
        <>
          <div className="cards" style={{ marginTop: "24px", gridTemplateColumns: "1fr 1fr" }}>
            <CreateInvoiceForm entries={entryOptions} />
            <RecordPaymentForm invoices={invoices} />
          </div>

          <div className="section-heading">
            <h2>Issued Invoices & Ledger</h2>
            <span>Audit trail of all team and player balances</span>
          </div>

          <section className="panel">
            <InvoicesTable invoices={invoices} teamMap={teamMap} />
          </section>
        </>
      )}
    </>
  );
}

