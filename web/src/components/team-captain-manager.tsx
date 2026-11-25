"use client";

import React, { useState } from "react";
import {
  addRosterSpotAction,
  bringBackSeasonRosterAction,
  grantClearanceOverrideAction,
  updateRosterStatusAction,
} from "@/app/(portal)/teams/[entryId]/captain-actions";

export interface TeamMemberItem {
  id: string; // roster_membership_id
  playerId: string;
  name: string;
  jersey: number | null;
  position: string;
  status: "active" | "inactive";
  isCleared: boolean;
  clearanceReason?: string;
  overrideId?: string | null;
}

interface TeamCaptainManagerProps {
  entryId: string;
  teamName: string;
  leagueId: string;
  seasonId?: string;
  seasonName: string;
  previousSeasonName?: string;
  canManage: boolean;
  roster: TeamMemberItem[];
}

export function TeamCaptainManager({
  entryId,
  teamName,
  leagueId,
  seasonId = "",
  seasonName,
  previousSeasonName = "Previous Season",
  canManage,
  roster,
}: TeamCaptainManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);

  // New spot form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newJersey, setNewJersey] = useState("");
  const [newPosition, setNewPosition] = useState("F");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getTeamInviteUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/teams/join?team=${entryId}`;
  };

  const getPlayerClaimUrl = (playerId: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/claim?player=${playerId}&team=${entryId}`;
  };

  const handleCopyTeamLink = () => {
    const url = getTeamInviteUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyClaimLink = (playerId: string) => {
    const url = getPlayerClaimUrl(playerId);
    navigator.clipboard.writeText(url);
    setCopiedPlayerId(playerId);
    setTimeout(() => setCopiedPlayerId(null), 2500);
  };

  const handleCreatePendingSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await addRosterSpotAction({
      entryId,
      leagueId,
      name: newName.trim(),
      jersey: newJersey ? parseInt(newJersey, 10) : null,
      position: newPosition,
      email: newEmail.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setNewName("");
      setNewEmail("");
      setNewJersey("");
      setShowAddModal(false);
      setStatusMessage({ type: "success", text: res.message });
    } else {
      setStatusMessage({ type: "error", text: res.message });
    }
  };

  const handleBringBackLastSeason = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    const res = await bringBackSeasonRosterAction({ entryId, leagueId });
    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: "success", text: res.message });
    } else {
      setStatusMessage({ type: "error", text: res.message });
    }
  };

  const handleToggleClearance = async (item: TeamMemberItem) => {
    setIsSubmitting(true);
    const res = await grantClearanceOverrideAction({
      rosterMembershipId: item.id,
      entryId,
      seasonId,
      leagueId,
      reason: `Waiver and liability clearance confirmed by captain for ${item.name}`,
    });
    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: "success", text: res.message });
    } else {
      setStatusMessage({ type: "error", text: res.message });
    }
  };

  const handleToggleActiveStatus = async (item: TeamMemberItem) => {
    const newStatus = item.status === "active" ? "inactive" : "active";
    const res = await updateRosterStatusAction({
      rosterMembershipId: item.id,
      entryId,
      newStatus,
    });
    if (res.success) {
      setStatusMessage({ type: "success", text: res.message });
    } else {
      setStatusMessage({ type: "error", text: res.message });
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
            Player Clearance Pipeline &amp; Claim Links ({roster.length} Players)
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
            Real database roster records: generate single-use claim links, grant digital waiver clearance, and share WhatsApp group links.
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
            disabled={isSubmitting}
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
            <span>+ Add Player Spot</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: statusMessage.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${statusMessage.type === "success" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
            color: statusMessage.type === "success" ? "#6ee7b7" : "#fca5a5",
            fontSize: "12.5px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMessage.type === "success" ? "✓ " : "✕ "} {statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Roster Clearance Status Table */}
      {roster.length > 0 ? (
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
              Player Clearance &amp; Verification Ledger ({roster.filter(r => r.isCleared).length} Cleared / {roster.length} Total)
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Direct database records from <code>roster_memberships</code>
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>PLAYER NAME</th>
                  <th style={{ width: "70px" }}>POS</th>
                  <th style={{ width: "120px" }}>ROSTER STATUS</th>
                  <th style={{ width: "180px" }}>CLEARANCE STATUS</th>
                  <th style={{ width: "230px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 800, color: "var(--lime)" }}>
                      {item.jersey ? `#${item.jersey}` : "—"}
                    </td>
                    <td>
                      <strong style={{ color: "var(--text)", fontSize: "13.5px" }}>{item.name}</strong>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{item.position}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActiveStatus(item)}
                        style={{
                          background: item.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: item.status === "active" ? "#34d399" : "#f87171",
                          border: "none",
                          borderRadius: "4px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        title="Click to toggle active / inactive"
                      >
                        {item.status.toUpperCase()}
                      </button>
                    </td>
                    <td>
                      {item.isCleared ? (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "#34d399",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                          title={item.clearanceReason || "Player meets all eligibility rules"}
                        >
                          🟢 Cleared to Play
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(249, 115, 22, 0.15)",
                            color: "#fb923c",
                            border: "1px solid rgba(249, 115, 22, 0.3)",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                          title={item.clearanceReason || "Waiver or registration pending"}
                        >
                          🟠 Waiver Needed (GHL)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        {!item.isCleared && (
                          <button
                            type="button"
                            onClick={() => handleToggleClearance(item)}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px", color: "var(--lime)" }}
                            title="Verify waiver and approve clearance"
                          >
                            ✓ Clear Player
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyClaimLink(item.playerId)}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", padding: "3px 8px" }}
                          title="Copy secure single-use claim link for this player"
                        >
                          {copiedPlayerId === item.playerId ? "✓ Copied" : "🔗 Claim Link"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            background: "#0c1822",
            border: "1px dashed #1f394d",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
        >
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "13.5px" }}>
            No players currently assigned to this team. Click <strong>+ Add Player Spot</strong> or <strong>Bring Back Last Season&apos;s Roster</strong> to populate.
          </p>
        </div>
      )}

      {/* Add Player Spot Modal */}
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
                  Add Player to Team Roster
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Saves directly to Supabase <code>players</code> and <code>roster_memberships</code>.
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
                  {isSubmitting ? "Adding to Database..." : "Add to Roster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
