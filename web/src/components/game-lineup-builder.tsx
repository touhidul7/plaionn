"use client";

import { useActionState, useState } from "react";
import { LINE_SLOTS, type LineupPlayer, type LineSlotKey } from "@/lib/lineups-schema";
import { saveGameLineupAction, type SaveLineupState } from "@/app/(portal)/schedule/[gameId]/lineup/actions";

interface Props {
  gameId: string;
  teamEntryId: string;
  teamName: string;
  initialPlayers: LineupPlayer[];
  canEdit: boolean;
}

const initialState: SaveLineupState = { status: "idle" };

export function GameLineupBuilder({
  gameId,
  teamEntryId,
  teamName,
  initialPlayers,
  canEdit,
}: Props) {
  const [state, formAction, isPending] = useActionState(saveGameLineupAction, initialState);

  // Map of slot key -> playerId
  const [slotMap, setSlotMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of initialPlayers) {
      if (p.line_assignment && p.line_assignment !== "SCRATCH") {
        map[p.line_assignment] = p.player_id;
      }
    }
    return map;
  });

  const handleSlotChange = (slotKey: string, newPlayerId: string) => {
    setSlotMap((prev) => {
      const next = { ...prev };
      // Remove player from other slot if they were assigned elsewhere
      for (const [k, v] of Object.entries(next)) {
        if (v === newPlayerId && k !== slotKey) {
          delete next[k];
        }
      }
      if (!newPlayerId) {
        delete next[slotKey];
      } else {
        next[slotKey] = newPlayerId;
      }
      return next;
    });
  };

  // Build JSON array for submission
  const assignmentsToSubmit = initialPlayers.map((player) => {
    const assignedSlot = Object.keys(slotMap).find((k) => slotMap[k] === player.player_id);
    return {
      player_id: player.player_id,
      line_assignment: assignedSlot || "SCRATCH",
      jersey_number: player.jersey_number,
    };
  });

  const getPlayer = (id: string) => initialPlayers.find((p) => p.player_id === id);

  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      {state.status === "error" && (
        <div className="notice" role="alert" style={{ borderColor: "#ef4444", color: "#fca5a5" }}>
          <strong>Error:</strong> {state.message}
        </div>
      )}
      {state.status === "success" && (
        <div className="notice" role="status" style={{ borderColor: "var(--lime)", color: "var(--lime)" }}>
          {state.message}
        </div>
      )}

      {/* Roster & RSVP Status Overview */}
      <section className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>Available Roster &amp; RSVP Status</h2>
          <span className="badge">{initialPlayers.length} Players</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {initialPlayers.map((p) => {
            const isAssigned = Object.values(slotMap).includes(p.player_id);
            const isAttending = p.rsvp_status === "attending";
            const isOut = p.rsvp_status === "out";

            return (
              <span
                key={p.player_id}
                className="badge"
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  background: isAttending ? "#163820" : isOut ? "#381818" : "#1a2e38",
                  borderColor: isAssigned ? "var(--lime)" : "var(--line)",
                  color: isAttending ? "var(--lime)" : isOut ? "#ffb0b0" : "var(--text)",
                }}
              >
                #{p.jersey_number ?? "—"} {p.display_name} ({p.player_position})
                {isAttending ? " · IN" : isOut ? " · OUT" : " · ?"}
                {isAssigned && " ✓"}
              </span>
            );
          })}
        </div>
      </section>

      {/* Interactive Hockey Lineup Formation */}
      <section className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>{teamName} — Tactical Lineup Board</h2>
          {canEdit && <span className="badge">Edit Mode Active</span>}
        </div>

        {/* Goaltenders */}
        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
            🥅 Goaltenders
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
            {["G_STARTER", "G_BACKUP"].map((slotKey) => {
              const assignedId = slotMap[slotKey] || "";
              const assignedPlayer = getPlayer(assignedId);

              return (
                <div key={slotKey} style={{ background: "#0c1921", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px", fontWeight: 700 }}>
                    {slotKey === "G_STARTER" ? "Starting Goalie (G1)" : "Backup Goalie (G2)"}
                  </label>
                  {canEdit ? (
                    <select
                      value={assignedId}
                      onChange={(e) => handleSlotChange(slotKey, e.target.value)}
                      style={{ width: "100%", height: "38px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "6px", padding: "0 8px" }}
                    >
                      <option value="">— Unassigned —</option>
                      {initialPlayers.map((p) => (
                        <option key={p.player_id} value={p.player_id}>
                          #{p.jersey_number ?? "—"} {p.display_name} ({p.player_position}) {p.rsvp_status === "attending" ? "[IN]" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <strong>{assignedPlayer ? `#${assignedPlayer.jersey_number ?? "—"} ${assignedPlayer.display_name}` : "TBD"}</strong>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Forward Lines */}
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
            ⚡ Forward Lines
          </h3>
          {[1, 2, 3].map((lineNum) => (
            <div key={lineNum} style={{ marginTop: "1rem" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "var(--lime)", letterSpacing: "0.05em" }}>
                Forward Line {lineNum}
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "6px" }}>
                {[`F${lineNum}_LW`, `F${lineNum}_C`, `F${lineNum}_RW`].map((slotKey) => {
                  const posName = slotKey.endsWith("_LW") ? "Left Wing" : slotKey.endsWith("_C") ? "Center" : "Right Wing";
                  const assignedId = slotMap[slotKey] || "";
                  const assignedPlayer = getPlayer(assignedId);

                  return (
                    <div key={slotKey} style={{ background: "#0c1921", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "4px", fontWeight: 700 }}>
                        {posName}
                      </label>
                      {canEdit ? (
                        <select
                          value={assignedId}
                          onChange={(e) => handleSlotChange(slotKey, e.target.value)}
                          style={{ width: "100%", height: "36px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "6px", padding: "0 8px", fontSize: "13px" }}
                        >
                          <option value="">— Empty —</option>
                          {initialPlayers.map((p) => (
                            <option key={p.player_id} value={p.player_id}>
                              #{p.jersey_number ?? "—"} {p.display_name} ({p.player_position})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <strong>{assignedPlayer ? `#${assignedPlayer.jersey_number ?? "—"} ${assignedPlayer.display_name}` : "—"}</strong>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Defense Pairings */}
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
            🛡️ Defensive Pairings
          </h3>
          {[1, 2, 3].map((pairNum) => (
            <div key={pairNum} style={{ marginTop: "1rem" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.05em" }}>
                Defense Pair {pairNum}
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "6px" }}>
                {[`D${pairNum}_LD`, `D${pairNum}_RD`].map((slotKey) => {
                  const posName = slotKey.endsWith("_LD") ? "Left Defense" : "Right Defense";
                  const assignedId = slotMap[slotKey] || "";
                  const assignedPlayer = getPlayer(assignedId);

                  return (
                    <div key={slotKey} style={{ background: "#0c1921", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)" }}>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "4px", fontWeight: 700 }}>
                        {posName}
                      </label>
                      {canEdit ? (
                        <select
                          value={assignedId}
                          onChange={(e) => handleSlotChange(slotKey, e.target.value)}
                          style={{ width: "100%", height: "36px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "6px", padding: "0 8px", fontSize: "13px" }}
                        >
                          <option value="">— Empty —</option>
                          {initialPlayers.map((p) => (
                            <option key={p.player_id} value={p.player_id}>
                              #{p.jersey_number ?? "—"} {p.display_name} ({p.player_position})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <strong>{assignedPlayer ? `#${assignedPlayer.jersey_number ?? "—"} ${assignedPlayer.display_name}` : "—"}</strong>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Save Lineup Form */}
        {canEdit && (
          <form action={formAction} style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
            <input type="hidden" name="gameId" value={gameId} />
            <input type="hidden" name="teamEntryId" value={teamEntryId} />
            <input type="hidden" name="assignments" value={JSON.stringify(assignmentsToSubmit)} />
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Saving..." : "Save Official Lineup"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
