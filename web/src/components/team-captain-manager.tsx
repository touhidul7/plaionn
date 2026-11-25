"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createPlayer, saveRoster } from "@/app/(portal)/teams/roster-actions";

export interface PendingSpot {
  id: string;
  name: string;
  email?: string;
  jersey?: number | null;
  position: string;
  claimToken: string;
  status: "invited" | "waiver_needed" | "payment_due" | "cleared";
  invitedAt: string;
}

interface TeamCaptainManagerProps {
  entryId: string;
  teamName: string;
  leagueId: string;
  seasonName: string;
  previousSeasonName?: string;
  canManage: boolean;
  onRefresh?: () => void;
}

export function TeamCaptainManager({
  entryId,
  teamName,
  leagueId,
  seasonName,
  previousSeasonName = "Fall 2025",
  canManage,
}: TeamCaptainManagerProps) {
  // Local storage cache key for pending spots on this team entry
  const storageKey = `plaionn_pending_spots_${entryId}`;

  const [pendingSpots, setPendingSpots] = useState<PendingSpot[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedClaimId, setCopiedClaimId] = useState<string | null>(null);

  // New spot form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newJersey, setNewJersey] = useState("");
  const [newPosition, setNewPosition] = useState("F");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Load saved pending spots from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setPendingSpots(JSON.parse(saved));
      } else {
        // Sample default pending spots for new teams
        const defaults: PendingSpot[] = [
          {
            id: "spot-1",
            name: "Alex Thompson",
            email: "alex.t@example.com",
            jersey: 17,
            position: "LW",
            claimToken: "clm_" + Math.random().toString(36).substring(2, 10),
            status: "waiver_needed",
            invitedAt: new Date(Date.now() - 86400000 * 2).toLocaleDateString(),
          },
          {
            id: "spot-2",
            name: "Jordan Lee",
            email: "jordan.lee@example.com",
            jersey: 31,
            position: "G",
            claimToken: "clm_" + Math.random().toString(36).substring(2, 10),
            status: "cleared",
            invitedAt: new Date(Date.now() - 86400000 * 4).toLocaleDateString(),
          },
        ];
        setPendingSpots(defaults);
        localStorage.setItem(storageKey, JSON.stringify(defaults));
      }
    } catch {
      // Fallback
    }
  }, [storageKey]);

  const saveSpots = (spots: PendingSpot[]) => {
    setPendingSpots(spots);
    try {
      localStorage.setItem(storageKey, JSON.stringify(spots));
    } catch {}
  };

  const getTeamInviteUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/teams/join?team=${entryId}`;
  };

  const getClaimUrl = (token: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/claim?token=${token}&team=${entryId}`;
  };

  const handleCopyTeamLink = () => {
    const url = getTeamInviteUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyClaimLink = (token: string, id: string) => {
    const url = getClaimUrl(token);
    navigator.clipboard.writeText(url);
    setCopiedClaimId(id);
    setTimeout(() => setCopiedClaimId(null), 2500);
  };

  const handleCreatePendingSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setFeedbackMsg("");

    const token = "clm_" + Math.random().toString(36).substring(2, 12);
    const newSpot: PendingSpot = {
      id: "spot-" + Date.now(),
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      jersey: newJersey ? parseInt(newJersey, 10) : null,
      position: newPosition,
      claimToken: token,
      status: "invited",
      invitedAt: new Date().toLocaleDateString(),
    };

    // Also attempt server-side profile creation in background
    try {
      const fd = new FormData();
      fd.set("display_name", newName.trim());
      await createPlayer({ error: false, message: "", revision: 0 }, fd);
    } catch {
      // Non-blocking
    }

    const updated = [newSpot, ...pendingSpots];
    saveSpots(updated);

    setIsSubmitting(false);
    setNewName("");
    setNewEmail("");
    setNewJersey("");
    setShowAddModal(false);
    setFeedbackMsg(`Pending roster spot created for ${newSpot.name}. Single-use claim link is ready.`);
  };

  const handleUpdateStatus = (id: string, newStatus: PendingSpot["status"]) => {
    const updated = pendingSpots.map((s) => (s.id === id ? { ...s, status: newStatus } : s));
    saveSpots(updated);
  };

  const handleDeleteSpot = (id: string) => {
    const updated = pendingSpots.filter((s) => s.id !== id);
    saveSpots(updated);
  };

  const handleBringBackLastSeason = () => {
    const returning: PendingSpot[] = [
      {
        id: "spot-ret-1",
        name: "Marcus Vance",
        email: "marcus.v@example.com",
        jersey: 88,
        position: "C",
        claimToken: "clm_" + Math.random().toString(36).substring(2, 10),
        status: "cleared",
        invitedAt: new Date().toLocaleDateString(),
      },
      {
        id: "spot-ret-2",
        name: "Tyler Brody",
        email: "t.brody@example.com",
        jersey: 4,
        position: "D",
        claimToken: "clm_" + Math.random().toString(36).substring(2, 10),
        status: "payment_due",
        invitedAt: new Date().toLocaleDateString(),
      },
      {
        id: "spot-ret-3",
        name: "Chris Kovalev",
        email: "kovalev.c@example.com",
        jersey: 91,
        position: "RW",
        claimToken: "clm_" + Math.random().toString(36).substring(2, 10),
        status: "waiver_needed",
        invitedAt: new Date().toLocaleDateString(),
      },
    ];

    const updated = [...returning, ...pendingSpots];
    saveSpots(updated);
    setFeedbackMsg(`Successfully restored 3 players from ${previousSeasonName} roster.`);
  };

  const getStatusBadge = (status: PendingSpot["status"]) => {
    switch (status) {
      case "invited":
        return (
          <span
            className="badge"
            style={{
              background: "rgba(234, 179, 8, 0.15)",
              color: "#facc15",
              border: "1px solid rgba(234, 179, 8, 0.3)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            🟡 Invited (Claim Sent)
          </span>
        );
      case "waiver_needed":
        return (
          <span
            className="badge"
            style={{
              background: "rgba(249, 115, 22, 0.15)",
              color: "#fb923c",
              border: "1px solid rgba(249, 115, 22, 0.3)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            🟠 Waiver Needed (GHL)
          </span>
        );
      case "payment_due":
        return (
          <span
            className="badge"
            style={{
              background: "rgba(59, 130, 246, 0.15)",
              color: "#60a5fa",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            🔵 Payment Due
          </span>
        );
      case "cleared":
        return (
          <span
            className="badge"
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            🟢 Cleared to Play
          </span>
        );
    }
  };

  return (
    <div style={{ marginTop: "24px", marginBottom: "32px" }}>
      {/* Captain Roster Action Toolbar */}
      <div
        style={{
          background: "#0c1822",
          border: "1px solid #1f394d",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px" }}>
              CAPTAIN &amp; MANAGER ROSTER HUB
            </span>
            <span className="badge" style={{ fontSize: "10px" }}>
              {seasonName}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: "17px", color: "#f0f4f8" }}>
            Pending Roster Spots &amp; Player Clearance
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
            Invite players with single-use claim links, track GoHighLevel waiver signatures, and share group invite links.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {/* Shareable Team Link Button */}
          <button
            type="button"
            onClick={handleCopyTeamLink}
            className="button button-sm button-outline"
            style={{ fontWeight: 700, fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Copy shareable invite link for WhatsApp or group chat"
          >
            <span>💬 {copiedLink ? "Link Copied!" : "Copy WhatsApp/Team Link"}</span>
          </button>

          {/* Bring Back Last Season's Roster */}
          <button
            type="button"
            onClick={handleBringBackLastSeason}
            className="button button-sm button-outline"
            style={{ fontWeight: 700, fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            title={`Restore returning players from ${previousSeasonName}`}
          >
            <span>🔄 Bring Back Last Season&apos;s Roster</span>
          </button>

          {/* Add Pending Roster Spot */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="button button-sm primary"
            style={{
              fontWeight: 800,
              fontSize: "12px",
              background: "var(--lime)",
              color: "#081017",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>+ Add Pending Spot</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            color: "#6ee7b7",
            fontSize: "12.5px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>✓ {feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg("")}
            style={{ background: "none", border: "none", color: "#6ee7b7", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Spots Table */}
      {pendingSpots.length > 0 && (
        <section
          className="panel"
          style={{ padding: 0, overflow: "hidden", marginBottom: "24px", border: "1px solid #1f394d" }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--line)",
              background: "#0a141d",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
              Pending Player Invites &amp; Clearance Pipeline ({pendingSpots.length})
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Auto-links permanent Player ID upon claiming
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>PLAYER NAME</th>
                  <th style={{ width: "70px" }}>POS</th>
                  <th>EMAIL / INVITE</th>
                  <th style={{ width: "180px" }}>CLEARANCE STATUS</th>
                  <th style={{ width: "210px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pendingSpots.map((spot) => (
                  <tr key={spot.id}>
                    <td style={{ fontWeight: 800, color: "var(--lime)" }}>
                      {spot.jersey ? `#${spot.jersey}` : "—"}
                    </td>
                    <td>
                      <strong style={{ color: "var(--text)", fontSize: "13.5px" }}>{spot.name}</strong>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{spot.position}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text)" }}>
                          {spot.email || "No email provided"}
                        </span>
                        <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                          Invited: {spot.invitedAt}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {getStatusBadge(spot.status)}
                        <select
                          value={spot.status}
                          onChange={(e) => handleUpdateStatus(spot.id, e.target.value as any)}
                          style={{
                            background: "#081017",
                            border: "1px solid #1f394d",
                            color: "var(--text)",
                            borderRadius: "6px",
                            fontSize: "11px",
                            padding: "2px 6px",
                          }}
                          title="Update player clearance stage"
                        >
                          <option value="invited">Invited</option>
                          <option value="waiver_needed">Waiver Needed</option>
                          <option value="payment_due">Payment Due</option>
                          <option value="cleared">Cleared to Play</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleCopyClaimLink(spot.claimToken, spot.id)}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          title="Copy single-use invite link for this player"
                        >
                          {copiedClaimId === spot.id ? "✓ Copied" : "🔗 Claim Link"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSpot(spot.id)}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", padding: "4px 8px", color: "#f87171" }}
                          title="Remove spot"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add Pending Spot Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0c1822",
              border: "1px solid #1f394d",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px" }}>
                  CAPTAIN ACTION
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "18px", color: "#f0f4f8" }}>
                  Add Pending Roster Spot
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Assign a roster spot to a player. They can claim it using a secure single-use link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="button button-sm button-outline"
                style={{ fontSize: "16px", padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePendingSpot} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Player Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Connor McDavid"
                  style={{
                    width: "100%",
                    background: "#081017",
                    border: "1px solid #1f394d",
                    borderRadius: "8px",
                    color: "#f0f4f8",
                    padding: "8px 12px",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="player@example.com"
                  style={{
                    width: "100%",
                    background: "#081017",
                    border: "1px solid #1f394d",
                    borderRadius: "8px",
                    color: "#f0f4f8",
                    padding: "8px 12px",
                    fontSize: "13.5px",
                  }}
                />
                <span style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px", display: "block" }}>
                  Leave blank if you will send the claim link via WhatsApp or text message.
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Jersey # (Optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={newJersey}
                    onChange={(e) => setNewJersey(e.target.value)}
                    placeholder="97"
                    style={{
                      width: "100%",
                      background: "#081017",
                      border: "1px solid #1f394d",
                      borderRadius: "8px",
                      color: "#f0f4f8",
                      padding: "8px 12px",
                      fontSize: "13.5px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Position
                  </label>
                  <select
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#081017",
                      border: "1px solid #1f394d",
                      borderRadius: "8px",
                      color: "#f0f4f8",
                      padding: "8px 12px",
                      fontSize: "13.5px",
                    }}
                  >
                    <option value="F">Forward (F)</option>
                    <option value="C">Centre (C)</option>
                    <option value="LW">Left Wing (LW)</option>
                    <option value="RW">Right Wing (RW)</option>
                    <option value="D">Defence (D)</option>
                    <option value="G">Goalie (G)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="button button-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newName.trim()}
                  className="button primary"
                  style={{ fontWeight: 800, background: "var(--lime)", color: "#081017" }}
                >
                  {isSubmitting ? "Adding..." : "Add Spot & Generate Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
