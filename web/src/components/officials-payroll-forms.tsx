"use client";

import { useActionState } from "react";
import {
  upsertOfficialProfileAction,
  markOfficialPayoutAction,
  type OfficialActionState,
} from "@/app/(portal)/league/officials/actions";

const initialState: OfficialActionState = { status: "idle" };

interface OfficialMember {
  user_id: string;
  email?: string;
  role: string;
}

export function OfficialRateCardForm({
  availableMembers,
}: {
  availableMembers: OfficialMember[];
}) {
  const [state, formAction, isPending] = useActionState(
    upsertOfficialProfileAction,
    initialState
  );

  return (
    <section className="panel">
      <div className="section-heading" style={{ marginTop: 0 }}>
        <h2>Configure Official Rate Card &amp; Certification</h2>
        <span className="badge">Commissioner Tool</span>
      </div>

      {state.status === "error" && (
        <div className="notice" role="alert" style={{ borderColor: "#ef4444", color: "#fca5a5", marginTop: "1rem" }}>
          {state.message}
        </div>
      )}
      {state.status === "success" && (
        <div className="notice" role="status" style={{ borderColor: "var(--lime)", color: "var(--lime)", marginTop: "1rem" }}>
          {state.message}
        </div>
      )}

      <form action={formAction} style={{ display: "grid", gap: "14px", marginTop: "1.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Select Official (Referee or Timekeeper)
            <select name="userId" required style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}>
              <option value="">— Choose Member —</option>
              {availableMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.email || m.user_id} ({m.role.toUpperCase()})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Full Name
            <input
              type="text"
              name="fullName"
              placeholder="e.g. Wes McCauley"
              required
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Certification Level
            <select name="certLevel" defaultValue="Level 2" style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}>
              <option value="Level 1">Level 1 (Junior / Novice)</option>
              <option value="Level 2">Level 2 (Standard Adult)</option>
              <option value="Level 3">Level 3 (Senior Competitive)</option>
              <option value="Level 4">Level 4 (Elite / Championship)</option>
              <option value="Master Official">Master Official / Supervisor</option>
              <option value="Timekeeper Cert">Timekeeper Certified</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Referee Fee per Game ($)
            <input
              type="number"
              name="refFee"
              step="0.50"
              defaultValue="45.00"
              min="0"
              required
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Timekeeper Fee per Game ($)
            <input
              type="number"
              name="timekeeperFee"
              step="0.50"
              defaultValue="30.00"
              min="0"
              required
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Certification Expiry Date
            <input
              type="date"
              name="certExpiry"
              defaultValue="2027-12-31"
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text)" }}>
            <input type="checkbox" name="isActive" defaultChecked style={{ width: "16px", height: "16px" }} />
            Active for Game Assignments
          </label>
          <button type="submit" className="button primary" disabled={isPending}>
            {isPending ? "Saving..." : "Save Rate Card"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function MarkPaidForm({
  userId,
  officialName,
  pendingDollars,
}: {
  userId: string;
  officialName: string;
  pendingDollars: string;
}) {
  const [state, formAction, isPending] = useActionState(
    markOfficialPayoutAction,
    initialState
  );

  return (
    <form action={formAction} style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
      <input type="hidden" name="userId" value={userId} />
      <input
        type="text"
        name="paymentRef"
        placeholder="Ref # (e.g. eTransfer)"
        required
        style={{
          height: "32px",
          width: "140px",
          fontSize: "12px",
          background: "#091219",
          color: "var(--text)",
          border: "1px solid var(--line)",
          borderRadius: "6px",
          padding: "0 6px",
        }}
      />
      <button
        type="submit"
        className="button button-sm primary"
        disabled={isPending}
        title={`Payout $${pendingDollars} to ${officialName}`}
      >
        {isPending ? "..." : `Pay $${pendingDollars}`}
      </button>
    </form>
  );
}
