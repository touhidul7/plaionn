"use client";

import { useActionState } from "react";
import type { PlayerAttendanceRecord, AttendanceHeadcount } from "@/lib/attendance-schema";
import { submitRsvpAction, type RsvpActionResult } from "@/app/(portal)/schedule/[gameId]/rsvp/actions";

interface TeamAttendanceViewProps {
  teamName: string;
  headcount: AttendanceHeadcount;
  records: PlayerAttendanceRecord[];
}

export function TeamHeadcountPills({ headcount }: { headcount: AttendanceHeadcount }) {
  const goalieAlert = headcount.attendingGoalies === 0;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0.75rem 0" }}>
      <span className="badge" style={{ backgroundColor: "#065f46", color: "#6ee7b7", borderColor: "#059669" }}>
        🏒 {headcount.attendingSkaters} Skaters In
      </span>
      <span
        className="badge"
        style={{
          backgroundColor: goalieAlert ? "#7f1d1d" : "#1e3a8a",
          color: goalieAlert ? "#fca5a5" : "#93c5fd",
          borderColor: goalieAlert ? "#dc2626" : "#2563eb",
          fontWeight: goalieAlert ? "bold" : "normal",
        }}
      >
        🥅 {headcount.attendingGoalies} {headcount.attendingGoalies === 1 ? "Goalie" : "Goalies"}
        {goalieAlert && " (NO GOALIE!)"}
      </span>
      {headcount.tentative > 0 && (
        <span className="badge" style={{ backgroundColor: "#78350f", color: "#fcd34d", borderColor: "#d97706" }}>
          ⏳ {headcount.tentative} Tentative
        </span>
      )}
      {headcount.out > 0 && (
        <span className="badge" style={{ backgroundColor: "#450a0a", color: "#f87171", borderColor: "#b91c1c" }}>
          ❌ {headcount.out} Out
        </span>
      )}
      {headcount.unconfirmed > 0 && (
        <span className="badge" style={{ backgroundColor: "#27272a", color: "#a1a1aa", borderColor: "#3f3f46" }}>
          ❓ {headcount.unconfirmed} Unconfirmed
        </span>
      )}
    </div>
  );
}

export function TeamAttendanceSection({ teamName, headcount, records }: TeamAttendanceViewProps) {
  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{teamName} Roster Availability</h3>
        <span className="badge">{headcount.totalRoster} rostered</span>
      </div>
      <TeamHeadcountPills headcount={headcount} />
      {records.length === 0 ? (
        <p className="empty">No rostered players found for this team.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player</th>
                <th scope="col">Pos</th>
                <th scope="col">Status</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const badgeClass = "badge";
                let badgeBg = "#27272a";
                let badgeColor = "#a1a1aa";
                if (r.rsvp_status === "attending") {
                  badgeBg = "#065f46";
                  badgeColor = "#6ee7b7";
                } else if (r.rsvp_status === "out") {
                  badgeBg = "#450a0a";
                  badgeColor = "#f87171";
                } else if (r.rsvp_status === "tentative") {
                  badgeBg = "#78350f";
                  badgeColor = "#fcd34d";
                }

                return (
                  <tr key={r.player_id}>
                    <td><strong>{r.jersey_number ?? "—"}</strong></td>
                    <td>{r.display_name}</td>
                    <td><span className="badge">{r.player_position}</span></td>
                    <td>
                      <span
                        className={badgeClass}
                        style={{ backgroundColor: badgeBg, color: badgeColor, textTransform: "uppercase" }}
                      >
                        {r.rsvp_status}
                      </span>
                    </td>
                    <td>{r.note || <span style={{ opacity: 0.4 }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface RsvpFormProps {
  gameId: string;
  players: { id: string; name: string; currentStatus?: string; currentNote?: string }[];
  isCaptainOrCommissioner: boolean;
}

export function PlayerRsvpForm({ gameId, players, isCaptainOrCommissioner }: RsvpFormProps) {
  const [state, formAction, isPending] = useActionState<RsvpActionResult | null, FormData>(
    submitRsvpAction,
    null
  );

  if (players.length === 0) {
    return null;
  }

  const defaultPlayer = players[0];

  return (
    <section className="panel" style={{ border: "1px solid var(--accent, #0284c7)" }}>
      <h2 style={{ marginTop: 0 }}>
        {isCaptainOrCommissioner ? "Submit Player RSVP" : "Your Game Attendance / RSVP"}
      </h2>
      <p style={{ color: "var(--muted, #94a3b8)", fontSize: "0.9rem" }}>
        Keep your captain and teammates informed so they know if a replacement goalie or sub skater is needed.
      </p>

      {state && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "6px",
            backgroundColor: state.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${state.success ? "#10b981" : "#ef4444"}`,
            color: state.success ? "#34d399" : "#f87171",
          }}
        >
          {state.message}
        </div>
      )}

      <form action={formAction} style={{ display: "grid", gap: "1rem" }}>
        <input type="hidden" name="gameId" value={gameId} />

        {players.length > 1 ? (
          <div>
            <label htmlFor="playerId" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
              Select Player:
            </label>
            <select
              id="playerId"
              name="playerId"
              className="input"
              defaultValue={defaultPlayer.id}
              style={{ width: "100%", padding: "0.5rem" }}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.currentStatus ? `(Currently: ${p.currentStatus})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <input type="hidden" name="playerId" value={defaultPlayer.id} />
            <p style={{ margin: 0 }}>
              RSVP for: <strong>{defaultPlayer.name}</strong>
              {defaultPlayer.currentStatus && (
                <span className="badge" style={{ marginLeft: "0.5rem" }}>
                  Current: {defaultPlayer.currentStatus.toUpperCase()}
                </span>
              )}
            </p>
          </div>
        )}

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Availability:</label>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="status"
                value="attending"
                defaultChecked={defaultPlayer.currentStatus === "attending" || !defaultPlayer.currentStatus}
                required
              />
              <span>🏒 Attending</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="status"
                value="tentative"
                defaultChecked={defaultPlayer.currentStatus === "tentative"}
              />
              <span>⏳ Tentative</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="status"
                value="out"
                defaultChecked={defaultPlayer.currentStatus === "out"}
              />
              <span>❌ Out</span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="note" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Note (optional, max 150 chars):
          </label>
          <input
            id="note"
            name="note"
            type="text"
            maxLength={150}
            defaultValue={defaultPlayer.currentNote || ""}
            placeholder="e.g., Running 10 mins late, or will be there early for warmup"
            className="input"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div>
          <button type="submit" className="button primary" disabled={isPending}>
            {isPending ? "Saving RSVP..." : "Confirm Availability"}
          </button>
        </div>
      </form>
    </section>
  );
}

