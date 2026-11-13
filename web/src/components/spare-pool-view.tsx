"use client";

import { useActionState, useState } from "react";
import type { SparePoolItem, GameCallupItem } from "@/lib/spares-schema";
import {
  registerSpareAction,
  requestCallupAction,
  respondCallupAction,
  type ActionResult,
} from "@/app/(portal)/spares/actions";

interface SparePoolViewProps {
  spares: SparePoolItem[];
  callups: GameCallupItem[];
  userPlayers: { id: string; name: string }[];
  upcomingGames: { id: string; matchup: string; date: string; homeEntryId: string; awayEntryId: string }[];
  canManage: boolean;
  currentUserId: string | null;
}

export function SparePoolView({
  spares,
  callups,
  userPlayers,
  upcomingGames,
  canManage,
  currentUserId,
}: SparePoolViewProps) {
  const [filterPos, setFilterPos] = useState<string>("all");
  const [selectedSpareForCallup, setSelectedSpareForCallup] = useState<SparePoolItem | null>(null);

  const filteredSpares = spares.filter((s) => {
    if (filterPos === "all") return true;
    return s.preferred_position === filterPos || s.preferred_position === "any";
  });

  const goalieCount = spares.filter((s) => s.preferred_position === "G" && s.is_available && !s.is_suspended).length;
  const skaterCount = spares.filter((s) => s.preferred_position !== "G" && s.is_available && !s.is_suspended).length;

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="panel" style={{ borderLeft: "4px solid #f59e0b" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>
            🥅 Available Goalies
          </span>
          <h2 style={{ fontSize: "2rem", margin: "0.25rem 0", color: "#fbbf24" }}>{goalieCount}</h2>
          <small style={{ color: "var(--muted, #94a3b8)" }}>Emergency substitute goaltenders</small>
        </div>

        <div className="panel" style={{ borderLeft: "4px solid #3b82f6" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>
            ⚡ Available Skaters
          </span>
          <h2 style={{ fontSize: "2rem", margin: "0.25rem 0", color: "#60a5fa" }}>{skaterCount}</h2>
          <small style={{ color: "var(--muted, #94a3b8)" }}>Defensemen &amp; Forwards</small>
        </div>

        <div className="panel" style={{ borderLeft: "4px solid #10b981" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>
            📋 Active Call-ups
          </span>
          <h2 style={{ fontSize: "2rem", margin: "0.25rem 0", color: "#34d399" }}>{callups.length}</h2>
          <small style={{ color: "var(--muted, #94a3b8)" }}>Dispatched game assignments</small>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
        {[
          ["all", "All Available Spares"],
          ["G", "🥅 Goalies"],
          ["D", "🛡️ Defense"],
          ["F", "⚡ Forwards"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filterPos === key ? "chip-btn active" : "chip-btn"}
            onClick={() => setFilterPos(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Spares Table */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>🏒 League Spare &amp; Sub Pool</h2>
          <span style={{ fontSize: "0.85rem", color: "var(--muted, #94a3b8)" }}>
            Showing {filteredSpares.length} players
          </span>
        </div>

        {filteredSpares.length === 0 ? (
          <p style={{ color: "var(--muted, #94a3b8)" }}>
            No available spare players matching this filter.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Position</th>
                  <th scope="col">Skill Level</th>
                  <th scope="col">Status</th>
                  <th scope="col">Notes / Availability</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpares.map((spare) => {
                  const getPosChip = () => {
                    switch (spare.preferred_position) {
                      case "G":
                        return <span className="badge" style={{ backgroundColor: "#78350f", color: "#fde68a" }}>GOALIE (G)</span>;
                      case "D":
                        return <span className="badge" style={{ backgroundColor: "#1e3a8a", color: "#93c5fd" }}>DEFENSE (D)</span>;
                      case "F":
                        return <span className="badge" style={{ backgroundColor: "#065f46", color: "#a7f3d0" }}>FORWARD (F)</span>;
                      default:
                        return <span className="badge" style={{ backgroundColor: "#3f3f46", color: "#e4e4e7" }}>ANY</span>;
                    }
                  };

                  return (
                    <tr key={spare.pool_id}>
                      <td>
                        <strong>{spare.player_name}</strong>
                      </td>
                      <td>{getPosChip()}</td>
                      <td>{spare.skill_level}</td>
                      <td>
                        {spare.is_suspended ? (
                          <span className="badge" style={{ backgroundColor: "#991b1b", color: "#fecaca" }}>SUSPENDED</span>
                        ) : (
                          <span className="badge" style={{ backgroundColor: "#065f46", color: "#a7f3d0" }}>AVAILABLE</span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--muted, #94a3b8)" }}>
                        {spare.notes || "Ready on call"}
                      </td>
                      <td>
                        {canManage && !spare.is_suspended && upcomingGames.length > 0 && (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => setSelectedSpareForCallup(spare)}
                            style={{ fontSize: "0.85rem", cursor: "pointer", color: "#38bdf8" }}
                          >
                            Call Up →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent / Active Call-ups section */}
      {callups.length > 0 && (
        <section className="panel">
          <h2>📢 Game Call-Up Assignments</h2>
          <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col">Position</th>
                  <th scope="col">Jersey</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {callups.map((c) => (
                  <tr key={c.callup_id}>
                    <td><strong>{c.player_name}</strong></td>
                    <td>{c.team_name}</td>
                    <td><span className="badge">{c.player_position}</span></td>
                    <td>{c.jersey_number !== null ? `#${c.jersey_number}` : "TBD"}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            c.status === "accepted" ? "#065f46" : c.status === "requested" ? "#92400e" : "#7f1d1d",
                          color:
                            c.status === "accepted" ? "#a7f3d0" : c.status === "requested" ? "#fde68a" : "#fecaca",
                        }}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {c.status === "requested" && (
                        <CallupResponseForm callupId={c.callup_id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Join Spare Pool Panel for Signed-In Players */}
      {userPlayers.length > 0 && (
        <details className="panel" style={{ marginTop: "0.5rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            ➕ Join or Update Your Availability in the Spare Pool
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <RegisterSpareForm userPlayers={userPlayers} />
          </div>
        </details>
      )}

      {/* Call-up Dispatch Modal */}
      {selectedSpareForCallup && (
        <CallupModal
          spare={selectedSpareForCallup}
          upcomingGames={upcomingGames}
          onClose={() => setSelectedSpareForCallup(null)}
        />
      )}
    </div>
  );
}

function RegisterSpareForm({ userPlayers }: { userPlayers: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    registerSpareAction,
    null
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: "500px" }}>
      {state && (
        <div
          role="status"
          style={{
            padding: "0.75rem",
            borderRadius: "4px",
            backgroundColor: state.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: state.success ? "#34d399" : "#f87171",
          }}
        >
          {state.message}
        </div>
      )}

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Player Profile:</label>
        <select name="playerId" className="input" style={{ width: "100%", padding: "0.5rem" }}>
          {userPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Preferred Position:</label>
          <select name="preferredPosition" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            <option value="G">Goalie (G)</option>
            <option value="D">Defense (D)</option>
            <option value="F">Forward (F)</option>
            <option value="any">Any Position</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Skill Level:</label>
          <select name="skillLevel" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            <option value="Advanced">Advanced / Tier 1</option>
            <option value="Intermediate">Intermediate / Tier 2</option>
            <option value="Novice">Novice / Rec</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
          <input type="checkbox" name="isAvailable" defaultChecked value="true" />
          I am currently available for game day call-ups
        </label>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Availability Notes:</label>
        <input
          name="notes"
          type="text"
          placeholder="e.g. Free Mon/Wed after 7 PM, text me anytime"
          className="input"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save Spare Availability"}
        </button>
      </div>
    </form>
  );
}

function CallupModal({
  spare,
  upcomingGames,
  onClose,
}: {
  spare: SparePoolItem;
  upcomingGames: { id: string; matchup: string; date: string; homeEntryId: string; awayEntryId: string }[];
  onClose: () => void;
}) {
  const [selectedGameId, setSelectedGameId] = useState(upcomingGames[0]?.id || "");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    requestCallupAction,
    null
  );

  const selectedGame = upcomingGames.find((g) => g.id === selectedGameId) ?? upcomingGames[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "1rem",
      }}
    >
      <div className="panel" style={{ width: "100%", maxWidth: "500px" }}>
        <h3>📢 Request Game Day Call-up</h3>
        <p style={{ fontSize: "0.9rem", color: "var(--muted, #94a3b8)" }}>
          Dispatching call-up to <strong>{spare.player_name}</strong> (Position: {spare.preferred_position}).
        </p>

        {state && (
          <div
            role="status"
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              backgroundColor: state.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: state.success ? "#34d399" : "#f87171",
              marginBottom: "1rem",
            }}
          >
            {state.message}
          </div>
        )}

        <form action={formAction} style={{ display: "grid", gap: "1rem" }}>
          <input type="hidden" name="playerId" value={spare.player_id} />

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Select Game:</label>
            <select
              name="gameId"
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            >
              {upcomingGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.matchup} ({g.date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Assign to Team:</label>
            <select name="teamEntryId" className="input" style={{ width: "100%", padding: "0.5rem" }}>
              <option value={selectedGame.homeEntryId}>Home Team</option>
              <option value={selectedGame.awayEntryId}>Away Team</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Position:</label>
              <select
                name="position"
                defaultValue={spare.preferred_position === "any" ? "F" : spare.preferred_position}
                className="input"
                style={{ width: "100%", padding: "0.5rem" }}
              >
                <option value="G">Goalie (G)</option>
                <option value="D">Defense (D)</option>
                <option value="F">Forward (F)</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Temp Jersey #:</label>
              <input
                name="jerseyNumber"
                type="number"
                min="0"
                max="99"
                defaultValue={spare.preferred_position === "G" ? "1" : "33"}
                className="input"
                style={{ width: "100%", padding: "0.5rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Dispatching..." : "Send Call-up Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CallupResponseForm({ callupId }: { callupId: string }) {
  const [, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    respondCallupAction,
    null
  );

  return (
    <div style={{ display: "flex", gap: "0.3rem" }}>
      <form action={formAction}>
        <input type="hidden" name="callupId" value={callupId} />
        <input type="hidden" name="accept" value="true" />
        <button type="submit" className="button primary" disabled={isPending} style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
          Accept
        </button>
      </form>
      <form action={formAction}>
        <input type="hidden" name="callupId" value={callupId} />
        <input type="hidden" name="accept" value="false" />
        <button type="submit" className="button" disabled={isPending} style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}>
          Decline
        </button>
      </form>
    </div>
  );
}

