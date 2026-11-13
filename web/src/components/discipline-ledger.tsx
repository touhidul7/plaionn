"use client";

import { useActionState, useState } from "react";
import type { DisciplineIncidentItem } from "@/lib/discipline-schema";
import {
  recordIncidentAction,
  appealSuspensionAction,
  resolveAppealAction,
  type ActionResult,
} from "@/app/(portal)/league/discipline/actions";

interface DisciplineLedgerProps {
  incidents: DisciplineIncidentItem[];
  seasons: { id: string; name: string }[];
  teams: { entryId: string; teamName: string; players: { id: string; name: string; jersey: number | null }[] }[];
  canManage: boolean;
  currentUserId: string | null;
}

export function DisciplineLedger({
  incidents,
  seasons,
  teams,
  canManage,
  currentUserId,
}: DisciplineLedgerProps) {
  const [activeAppealIncident, setActiveAppealIncident] = useState<DisciplineIncidentItem | null>(null);
  const [activeResolveIncident, setActiveResolveIncident] = useState<DisciplineIncidentItem | null>(null);

  const activeCount = incidents.filter((i) => i.status === "active").length;
  const appealedCount = incidents.filter((i) => i.status === "appealed").length;
  const servedCount = incidents.filter((i) => i.status === "served").length;

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="panel" style={{ borderLeft: "4px solid #ef4444" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>
            Active Suspensions
          </span>
          <h2 style={{ fontSize: "2rem", margin: "0.25rem 0", color: "#f87171" }}>{activeCount}</h2>
          <small style={{ color: "var(--muted, #94a3b8)" }}>Players currently ineligible</small>
        </div>

        <div className="panel" style={{ borderLeft: "4px solid #f59e0b" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>
            Pending Appeals
          </span>
          <h2 style={{ fontSize: "2rem", margin: "0.25rem 0", color: "#fbbf24" }}>{appealedCount}</h2>
          <small style={{ color: "var(--muted, #94a3b8)" }}>Awaiting commissioner review</small>
        </div>

        <div className="panel" style={{ borderLeft: "4px solid #10b981" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted, #94a3b8)", textTransform: "uppercase" }}>
            Completed / Served
          </span>
          <h2 style={{ fontSize: "2rem", margin: "0.25rem 0", color: "#34d399" }}>{servedCount}</h2>
          <small style={{ color: "var(--muted, #94a3b8)" }}>Eligible &amp; reinstated</small>
        </div>
      </div>

      {/* Incidents Table */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>📋 Official Disciplinary Ledger</h2>
          <span style={{ fontSize: "0.85rem", color: "var(--muted, #94a3b8)" }}>
            {incidents.length} total recorded incidents
          </span>
        </div>

        {incidents.length === 0 ? (
          <p style={{ color: "var(--muted, #94a3b8)" }}>
            No disciplinary incidents or suspensions recorded for this league.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col">Infraction</th>
                  <th scope="col">PIM</th>
                  <th scope="col">Suspended</th>
                  <th scope="col">Remaining</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => {
                  const getStatusBadge = () => {
                    switch (inc.status) {
                      case "active":
                        return <span className="badge" style={{ backgroundColor: "#991b1b", color: "#fecaca" }}>SUSPENDED</span>;
                      case "appealed":
                        return <span className="badge" style={{ backgroundColor: "#92400e", color: "#fde68a" }}>UNDER APPEAL</span>;
                      case "served":
                        return <span className="badge" style={{ backgroundColor: "#065f46", color: "#a7f3d0" }}>SERVED</span>;
                      case "revoked":
                        return <span className="badge" style={{ backgroundColor: "#3f3f46", color: "#d4d4d8" }}>OVERTURNED</span>;
                    }
                  };

                  return (
                    <tr key={inc.incident_id}>
                      <td>{inc.incident_date}</td>
                      <td>
                        <strong>{inc.player_name}</strong>
                        {inc.jersey_number !== null && (
                          <span style={{ marginLeft: "0.3rem", opacity: 0.7 }}>#{inc.jersey_number}</span>
                        )}
                      </td>
                      <td>{inc.team_name}</td>
                      <td>
                        <strong>{inc.infraction}</strong>
                        {inc.notes && (
                          <small style={{ display: "block", color: "var(--muted, #94a3b8)" }}>{inc.notes}</small>
                        )}
                        {inc.appeal_notes && (
                          <small style={{ display: "block", color: "#fbbf24", fontStyle: "italic" }}>
                            Appeal: &ldquo;{inc.appeal_notes}&rdquo;
                          </small>
                        )}
                      </td>
                      <td>{inc.penalty_minutes}</td>
                      <td>{inc.games_suspended}G</td>
                      <td>
                        <strong style={{ color: inc.games_remaining > 0 ? "#f87171" : "inherit" }}>
                          {inc.games_remaining}G
                        </strong>
                      </td>
                      <td>{getStatusBadge()}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {/* Appeal button for player */}
                          {(inc.status === "active" || inc.status === "appealed") && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => setActiveAppealIncident(inc)}
                              style={{ fontSize: "0.8rem", cursor: "pointer" }}
                            >
                              {inc.status === "appealed" ? "Edit Appeal" : "Appeal"}
                            </button>
                          )}

                          {/* Commissioner resolve button */}
                          {canManage && (inc.status === "active" || inc.status === "appealed") && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => setActiveResolveIncident(inc)}
                              style={{ fontSize: "0.8rem", cursor: "pointer", color: "#38bdf8" }}
                            >
                              Resolve →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Commissioner Incident Form */}
      {canManage && (
        <details className="panel" style={{ marginTop: "0.5rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            ➕ Commissioner: Record New Disciplinary Incident / Suspension
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <LogIncidentForm seasons={seasons} teams={teams} />
          </div>
        </details>
      )}

      {/* Appeal Modal */}
      {activeAppealIncident && (
        <AppealModal
          incident={activeAppealIncident}
          onClose={() => setActiveAppealIncident(null)}
        />
      )}

      {/* Commissioner Resolve Modal */}
      {activeResolveIncident && (
        <ResolveModal
          incident={activeResolveIncident}
          onClose={() => setActiveResolveIncident(null)}
        />
      )}
    </div>
  );
}

function LogIncidentForm({
  seasons,
  teams,
}: {
  seasons: { id: string; name: string }[];
  teams: { entryId: string; teamName: string; players: { id: string; name: string; jersey: number | null }[] }[];
}) {
  const [selectedEntryId, setSelectedEntryId] = useState<string>(teams[0]?.entryId || "");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    recordIncidentAction,
    null
  );

  const selectedTeam = teams.find((t) => t.entryId === selectedEntryId) ?? teams[0];
  const availablePlayers = selectedTeam?.players || [];

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: "600px" }}>
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

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Season:</label>
          <select name="seasonId" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Team:</label>
          <select
            name="teamEntryId"
            value={selectedEntryId}
            onChange={(e) => setSelectedEntryId(e.target.value)}
            className="input"
            style={{ width: "100%", padding: "0.5rem" }}
          >
            {teams.map((t) => (
              <option key={t.entryId} value={t.entryId}>
                {t.teamName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Player:</label>
        <select name="playerId" required className="input" style={{ width: "100%", padding: "0.5rem" }}>
          {availablePlayers.length === 0 ? (
            <option value="">No active players found on this roster</option>
          ) : (
            availablePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.jersey !== null ? `(#${p.jersey})` : ""}
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Infraction:</label>
        <input
          name="infraction"
          type="text"
          required
          placeholder="e.g. Match Penalty - Abuse of Officials, Fighting Major"
          className="input"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Penalty Minutes:</label>
          <input
            name="penaltyMinutes"
            type="number"
            min="0"
            defaultValue="10"
            className="input"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Suspension (Games):
          </label>
          <input
            name="gamesSuspended"
            type="number"
            min="0"
            defaultValue="2"
            required
            className="input"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Incident Notes / Evidence:</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="Game details, referee report, incident summary..."
          className="input"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? "Recording Suspension..." : "Record Disciplinary Incident"}
        </button>
      </div>
    </form>
  );
}

function AppealModal({
  incident,
  onClose,
}: {
  incident: DisciplineIncidentItem;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    appealSuspensionAction,
    null
  );

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
        <h3>⚖️ Submit Suspension Appeal</h3>
        <p style={{ fontSize: "0.9rem", color: "var(--muted, #94a3b8)" }}>
          Appealing {incident.games_suspended}-game suspension for <strong>{incident.player_name}</strong> (
          {incident.infraction}).
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
          <input type="hidden" name="incidentId" value={incident.incident_id} />

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
              Player / Team Statement:
            </label>
            <textarea
              name="statement"
              required
              rows={4}
              defaultValue={incident.appeal_notes || ""}
              placeholder="State the circumstances, video timestamp, or rule clarification for the commissioner's review..."
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="button" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Appeal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResolveModal({
  incident,
  onClose,
}: {
  incident: DisciplineIncidentItem;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState<"upheld" | "reduced" | "overturned">("upheld");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    resolveAppealAction,
    null
  );

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
      <div className="panel" style={{ width: "100%", maxWidth: "520px" }}>
        <h3>⚖️ Commissioner: Resolve Suspension Appeal</h3>
        <p style={{ fontSize: "0.9rem", color: "var(--muted, #94a3b8)" }}>
          Player: <strong>{incident.player_name}</strong> · Infraction: <strong>{incident.infraction}</strong> (
          {incident.games_suspended} Games)
        </p>

        {incident.appeal_notes && (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: "4px",
              borderLeft: "3px solid #fbbf24",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            <strong>Appellant Statement:</strong>
            <p style={{ margin: "0.25rem 0 0 0", fontStyle: "italic" }}>&ldquo;{incident.appeal_notes}&rdquo;</p>
          </div>
        )}

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
          <input type="hidden" name="incidentId" value={incident.incident_id} />

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Decision:</label>
            <select
              name="decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value as any)}
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            >
              <option value="upheld">Uphold Suspension (No change)</option>
              <option value="reduced">Reduce Suspension (Decrease game count)</option>
              <option value="overturned">Overturn / Rescind Suspension (Player reinstated)</option>
            </select>
          </div>

          {decision === "reduced" && (
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                New Suspension (Games):
              </label>
              <input
                name="newSuspendedGames"
                type="number"
                min="0"
                max={incident.games_suspended}
                defaultValue={Math.max(1, incident.games_suspended - 1)}
                className="input"
                style={{ width: "100%", padding: "0.5rem" }}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
              Commissioner Ruling Notes:
            </label>
            <textarea
              name="commissionerNotes"
              rows={3}
              placeholder="State reasons for upholding, reducing, or rescinding..."
              className="input"
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Recording Ruling..." : "Save Ruling"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
