"use client";

import React, { useState } from "react";
import Link from "next/link";
import { claimRosterSpotAction } from "@/app/(portal)/teams/[entryId]/captain-actions";

interface ClaimSpotClientProps {
  token: string;
  spotName: string;
  teamName: string;
  seasonName: string;
  leagueName: string;
  position: string;
  jersey: number | null;
  entryId: string;
  userEmail: string | null;
}

export function ClaimSpotClient({
  token,
  spotName,
  teamName,
  seasonName,
  leagueName,
  position,
  jersey,
  entryId,
  userEmail,
}: ClaimSpotClientProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    registrationId?: string;
  } | null>(null);

  const handleClaim = async () => {
    setSubmitting(true);
    const res = await claimRosterSpotAction({ token });
    setSubmitting(false);
    setResult({
      success: res.success,
      message: res.message,
      registrationId: res.registrationId,
    });
  };

  if (result?.success) {
    return (
      <section className="panel" style={{ padding: "32px", maxWidth: "560px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>✓</div>
        <h2 style={{ margin: "0 0 8px", color: "var(--lime)" }}>Roster Spot Claimed!</h2>
        <p style={{ color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
          You are now linked to <strong>{teamName}</strong> for <strong>{seasonName}</strong>.
          {result.registrationId && (
            <>
              <br />
              <span style={{ fontSize: "12px" }}>Registration ID: <code>{result.registrationId}</code></span>
            </>
          )}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/registration" className="button primary">
            Complete Waiver &amp; Payment →
          </Link>
          <Link href={`/teams/${entryId}`} className="button button-outline">
            View Team Roster
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" style={{ padding: "32px", maxWidth: "560px", margin: "0 auto" }}>
      <span className="badge" style={{ marginBottom: "12px" }}>
        {leagueName} · SINGLE-USE INVITE
      </span>
      <h1 style={{ fontSize: "26px", margin: "4px 0 8px" }}>
        Join {teamName} for {seasonName}
      </h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Your team captain reserved a pending roster spot for <strong>{spotName}</strong> ({position}
        {jersey !== null ? ` · #${jersey}` : ""}).
      </p>

      {result && !result.success && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            marginBottom: "16px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            fontSize: "13px",
          }}
        >
          {result.message}
        </div>
      )}

      {!userEmail ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text)" }}>
            Sign in with your own verified email to claim this spot. Your login email does not need to match the email your captain entered.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/claim?token=${token}`)}`}
            className="button primary"
            style={{ textAlign: "center", padding: "12px 20px" }}
          >
            Sign In to Claim Roster Spot →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ padding: "12px 14px", borderRadius: "8px", background: "#081017", border: "1px solid var(--line)", fontSize: "13px" }}>
            Signed in as: <strong style={{ color: "var(--lime)" }}>{userEmail}</strong>
          </div>
          <button
            type="button"
            onClick={handleClaim}
            disabled={submitting}
            className="button primary"
            style={{ padding: "12px 20px", fontSize: "14px" }}
          >
            {submitting ? "Claiming Spot..." : `Confirm: Join ${teamName} →`}
          </button>
        </div>
      )}
    </section>
  );
}
