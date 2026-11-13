"use client";

import { useActionState, useState } from "react";
import {
  createTeamInvoiceAction,
  recordInvoicePaymentAction,
  type BillingActionState,
} from "@/app/(portal)/league/billing/actions";
import type { InvoiceRow } from "@/lib/billing-schema";

const initial: BillingActionState = { error: false, message: "" };

export function CreateInvoiceForm({
  entries,
}: {
  entries: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createTeamInvoiceAction, initial);

  return (
    <form action={action} className="panel form-stack">
      <h2>Issue Team Invoice</h2>
      <p>Issue an invoice to a team entry for season registration or ice fees.</p>

      <div className="settings-grid">
        <label>
          Team
          <select name="team_entry_id" required defaultValue="">
            <option value="" disabled>
              Select team entry
            </option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Invoice title
          <input
            name="title"
            required
            maxLength={150}
            placeholder="e.g. 2026 Season Team Registration"
          />
        </label>

        <label>
          Amount ($ CAD)
          <input
            name="amount_cents"
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="1000.00"
          />
        </label>

        <label>
          Due date (optional)
          <input type="date" name="due_date" />
        </label>
      </div>

      <button className="primary" disabled={pending || !entries.length}>
        {pending ? "Issuing invoice…" : "Issue invoice →"}
      </button>

      {state.message && (
        <p role="status" className={"form-message" + (state.error ? " error" : "")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function RecordPaymentForm({
  invoices,
}: {
  invoices: InvoiceRow[];
}) {
  const [state, action, pending] = useActionState(recordInvoicePaymentAction, initial);
  const payableInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "void");
  const [selectedId, setSelectedId] = useState(payableInvoices[0]?.id ?? "");

  const selectedInv = payableInvoices.find((i) => i.id === selectedId);
  const remainingDollars = selectedInv
    ? ((selectedInv.amount_cents - selectedInv.amount_paid_cents) / 100).toFixed(2)
    : "0.00";

  return (
    <form action={action} className="panel form-stack">
      <h2>Record Offline Payment / Reconciliation</h2>
      <p>Reconcile cash, Interac e-Transfer, or cheque payments received at the arena.</p>

      <div className="settings-grid">
        <label>
          Invoice
          <select
            name="invoice_id"
            required
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {payableInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.title} (Balance: ${( (inv.amount_cents - inv.amount_paid_cents) / 100 ).toFixed(2)}{" "}
                {inv.currency})
              </option>
            ))}
          </select>
        </label>

        <label>
          Payment amount ($ CAD)
          <input
            name="amount_cents"
            required
            defaultValue={remainingDollars}
            key={selectedId}
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="500.00"
          />
        </label>

        <label>
          Payment method
          <select name="payment_method" defaultValue="etransfer">
            <option value="etransfer">Interac e-Transfer</option>
            <option value="cash">Cash (Rink Office)</option>
            <option value="cheque">Cheque</option>
            <option value="credit_card">Card (In-person / Terminal)</option>
            <option value="stripe">Online Stripe</option>
          </select>
        </label>

        <label>
          Reference / Confirmation #
          <input
            name="reference_number"
            maxLength={100}
            placeholder="e.g. ETR-202611-091"
          />
        </label>
      </div>

      <label>
        Internal notes (optional)
        <input name="notes" maxLength={500} placeholder="Received by commissioner" />
      </label>

      <button className="primary" disabled={pending || !payableInvoices.length}>
        {pending ? "Recording payment…" : "Record payment & reconcile →"}
      </button>

      {state.message && (
        <p role="status" className={"form-message" + (state.error ? " error" : "")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function InvoicesTable({
  invoices,
  teamMap,
}: {
  invoices: InvoiceRow[];
  teamMap: Map<string, string>;
}) {
  if (!invoices.length) {
    return (
      <div className="empty">
        <h2>No invoices issued</h2>
        <p>Issue an invoice to a team above to start tracking collections and balances.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Recipient</th>
            <th scope="col">Total</th>
            <th scope="col">Paid</th>
            <th scope="col">Balance</th>
            <th scope="col">Due Date</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const recipient = inv.team_entry_id
              ? teamMap.get(inv.team_entry_id) ?? "Team"
              : "Player";
            const balance = ((inv.amount_cents - inv.amount_paid_cents) / 100).toFixed(2);
            return (
              <tr key={inv.id}>
                <td>
                  <strong>{inv.title}</strong>
                </td>
                <td>{recipient}</td>
                <td>
                  ${(inv.amount_cents / 100).toFixed(2)} {inv.currency}
                </td>
                <td>
                  ${(inv.amount_paid_cents / 100).toFixed(2)} {inv.currency}
                </td>
                <td>
                  <strong>
                    ${balance} {inv.currency}
                  </strong>
                </td>
                <td>{inv.due_date ?? "None"}</td>
                <td>
                  <span className="badge">
                    {inv.status.replace("_", " ").toUpperCase()}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

