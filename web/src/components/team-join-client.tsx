"use client";

import React, { useState } from "react";
import Link from "next/link";
import { requestToJoinTeamAction } from "@/app/(portal)/teams/[entryId]/captain-actions";

interface TeamJoinClientProps {
  entryId: string;
  teamName: string;
  seasonName: string;
  leagueName: string;
  userEmail: string | null;
  defaultName: string;
}

export function TeamJoinClient({
  entryId,
  teamName,
  seasonName,
  leagueName,
  userEmail,
  defaultName,
}: TeamJoinClientProps) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [position, setPosition] = useState("F");
  const [jersey, setJersey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await requestToJoinTeamAction({
      entryId,
      displayName: displayName.trim(),
      position,
      jersey: jersey ? parseInt(jersey, 10) : null,
    });
    setSubmitting(false);
    setResult(res);
  };

  if (result?.success) {
    return (
      <section className="panel" style={{ padding: "32px", maxWidth: "560px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>✓</div>
        <h2 style={{ margin: "0 0 8px", color: "var(--lime)" }}>Join Request Sent!</h2>
        <p style={{ color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
          {result.message}
        </p>
        <Link href={`/teams/${entryId}`} className="button primary">
          View {teamName} Page →
        </Link>
      </section>
    );
  }

  return (
    <section className="panel" style={{ padding: "32px", maxWidth: "560px", margin: "0 auto" }}>
      <span className="badge" style={{ marginBottom: "12px" }}>
        {leagueName} · TEAM JOIN LINK
      </span>
      <h1 style={{ fontSize: "26px", margin: "4px 0 8px" }}>
        Request to Join {teamName}
      </h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Season: <strong>{seasonName}</strong>. Submit a join request and your team captain will approve you or match you to your pending roster spot.
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
        <Link
          href={`/login?next=${encodeURIComponent(`/teams/join?team=${entryId}`)}`}
          className="button primary"
          style={{ display: "block", textAlign: "center", padding: "12px 20px" }}
        >
          Sign In to Request to Join →
        </Link>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#081017", border: "1px solid var(--line)", fontSize: "12.5px" }}>
            Signed in as: <strong style={{ color: "var(--lime)" }}>{userEmail}</strong>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase" }}>
              Your Full Name *
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#081017", border: "1px solid var(--line)", color: "var(--text)" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase" }}>
                Position
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#081017", border: "1px solid var(--line)", color: "var(--text)" }}
              >
                <option value="F">Forward (F)</option>
                <option value="D">Defense (D)</option>
                <option value="G">Goalie (G)</option>
                <option value="C">Center (C)</option>
                <option value="LW">Left Wing (LW)</option>
                <option value="RW">Right Wing (RW)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase" }}>
                Jersey # (Optional)
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                placeholder="19"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", background: "#081017", border: "1px solid var(--line)", color: "var(--text)" }}
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="button primary" style={{ padding: "12px 20px" }}>
            {submitting ? "Sending Request..." : "Request to Join Team →"}
          </button>
        </form>
      )}
    </section>
  );
}
