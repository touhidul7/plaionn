"use client";

import { useActionState, useState } from "react";
import type { PlayoffTournamentDetails, PlayoffSeriesItem } from "@/lib/playoffs-schema";
import {
  generateBracketAction,
  updateSeriesScoreAction,
  type ActionResult,
} from "@/app/(portal)/playoffs/actions";

interface PlayoffBracketProps {
  tournament: PlayoffTournamentDetails | null;
  divisions: { id: string; name: string }[];
  canManage: boolean;
}

export function PlayoffBracketView({ tournament, divisions, canManage }: PlayoffBracketProps) {
  if (!tournament) {
    return (
      <section className="panel">
        <h2>🏆 Playoff Tournament Brackets</h2>
        <p style={{ color: "var(--muted, #94a3b8)" }}>
          No active playoff tournament found for this division.
        </p>
        {canManage && divisions.length > 0 && (
          <GenerateBracketForm divisions={divisions} />
        )}
      </section>
    );
  }

  // Group series by round
  const roundsMap = new Map<number, PlayoffSeriesItem[]>();
  for (const s of tournament.series) {
    if (!roundsMap.has(s.round_number)) {
      roundsMap.set(s.round_number, []);
    }
    roundsMap.get(s.round_number)!.push(s);
  }

  const roundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  const getRoundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return "🏆 Championship Final";
    if (round === totalRounds - 1) return "⚡ Semifinals";
    return "⚔️ Quarterfinals";
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <span className="badge" style={{ backgroundColor: "#1e3a8a", color: "#93c5fd" }}>
            {tournament.format === "best_of_3" ? "Best-of-3 Series" : "Single Elimination"}
          </span>
          <h2 style={{ margin: "0.25rem 0" }}>{tournament.name}</h2>
          <span style={{ fontSize: "0.9rem", color: "var(--muted, #94a3b8)" }}>
            {tournament.team_count} Teams · Status: <strong>{tournament.status.toUpperCase()}</strong>
          </span>
        </div>
      </div>

      {/* Bracket Tree Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${roundNumbers.length}, minmax(280px, 1fr))`,
          gap: "1.5rem",
          alignItems: "center",
          overflowX: "auto",
          paddingBottom: "1rem",
        }}
      >
        {roundNumbers.map((rNum) => {
          const seriesInRound = roundsMap.get(rNum)!;
          return (
            <div key={rNum} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ textAlign: "center", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <h3 style={{ margin: 0 }}>{getRoundLabel(rNum, roundNumbers.length)}</h3>
              </div>

              {seriesInRound.map((series) => (
                <SeriesCard
                  key={series.id}
                  series={series}
                  format={tournament.format}
                  canManage={canManage}
                />
              ))}
            </div>
          );
        })}
      </div>

      {canManage && (
        <details className="panel" style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            ⚙️ Commissioner: Re-generate or create a new bracket
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <GenerateBracketForm divisions={divisions} />
          </div>
        </details>
      )}
    </div>
  );
}

function SeriesCard({
  series,
  format,
  canManage,
}: {
  series: PlayoffSeriesItem;
  format: "single_elimination" | "best_of_3";
  canManage: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateSeriesScoreAction,
    null
  );

  const winsNeeded = format === "best_of_3" ? 2 : 1;
  const isHighWinner = series.winner_entry_id && series.winner_entry_id === series.high_seed_entry_id;
  const isLowWinner = series.winner_entry_id && series.winner_entry_id === series.low_seed_entry_id;

  return (
    <article
      className="panel"
      style={{
        padding: "0.85rem",
        backgroundColor: "var(--panel-bg, #18181b)",
        border: series.status === "completed" ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        boxShadow: series.status === "completed" ? "0 0 10px rgba(16, 185, 129, 0.15)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--muted, #a1a1aa)", textTransform: "uppercase" }}>
          Series #{series.series_order}
        </span>
        <span
          className="badge"
          style={{
            fontSize: "0.7rem",
            backgroundColor: series.status === "completed" ? "#065f46" : "#27272a",
            color: series.status === "completed" ? "#6ee7b7" : "#a1a1aa",
          }}
        >
          {series.status.toUpperCase()}
        </span>
      </div>

      {/* High Seed */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.4rem 0.6rem",
          borderRadius: "4px",
          backgroundColor: isHighWinner ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.03)",
          fontWeight: isHighWinner ? 700 : 500,
          borderLeft: isHighWinner ? "3px solid #10b981" : "3px solid transparent",
          marginBottom: "0.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {series.high_seed_rank && (
            <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>#{series.high_seed_rank}</span>
          )}
          <span>{series.high_seed_name}</span>
          {isHighWinner && <span>🏆</span>}
        </div>
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>{series.high_seed_wins}</span>
      </div>

      {/* Low Seed */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.4rem 0.6rem",
          borderRadius: "4px",
          backgroundColor: isLowWinner ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.03)",
          fontWeight: isLowWinner ? 700 : 500,
          borderLeft: isLowWinner ? "3px solid #10b981" : "3px solid transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {series.low_seed_rank && (
            <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>#{series.low_seed_rank}</span>
          )}
          <span>{series.low_seed_name}</span>
          {isLowWinner && <span>🏆</span>}
        </div>
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>{series.low_seed_wins}</span>
      </div>

      {/* Commissioner quick update */}
      {canManage && series.high_seed_entry_id && series.low_seed_entry_id && (
        <div style={{ marginTop: "0.6rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.5rem" }}>
          {!isEditing ? (
            <button
              type="button"
              className="text-link"
              onClick={() => setIsEditing(true)}
              style={{ fontSize: "0.8rem", cursor: "pointer" }}
            >
              Update Series Score →
            </button>
          ) : (
            <form action={formAction} style={{ display: "grid", gap: "0.5rem", marginTop: "0.4rem" }}>
              <input type="hidden" name="seriesId" value={series.id} />

              {state && (
                <p style={{ fontSize: "0.75rem", color: state.success ? "#34d399" : "#f87171", margin: 0 }}>
                  {state.message}
                </p>
              )}

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <label style={{ fontSize: "0.75rem" }}>
                  {series.high_seed_name.slice(0, 10)} wins:
                  <input
                    type="number"
                    name="highWins"
                    min="0"
                    max={winsNeeded}
                    defaultValue={series.high_seed_wins}
                    className="input"
                    style={{ width: "3.5rem", padding: "0.2rem", marginLeft: "0.25rem" }}
                  />
                </label>
                <label style={{ fontSize: "0.75rem" }}>
                  {series.low_seed_name.slice(0, 10)} wins:
                  <input
                    type="number"
                    name="lowWins"
                    min="0"
                    max={winsNeeded}
                    defaultValue={series.low_seed_wins}
                    className="input"
                    style={{ width: "3.5rem", padding: "0.2rem", marginLeft: "0.25rem" }}
                  />
                </label>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", display: "block" }}>
                  Declare Winner:
                  <select
                    name="winnerEntryId"
                    defaultValue={series.winner_entry_id || ""}
                    className="input"
                    style={{ width: "100%", padding: "0.2rem", fontSize: "0.8rem", marginTop: "0.2rem" }}
                  >
                    <option value="">In Progress (No Winner Yet)</option>
                    <option value={series.high_seed_entry_id}>{series.high_seed_name} (Advances)</option>
                    <option value={series.low_seed_entry_id}>{series.low_seed_name} (Advances)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" className="button button-sm primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Score"}
                </button>
                <button
                  type="button"
                  className="button button-sm button-outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function GenerateBracketForm({ divisions }: { divisions: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    generateBracketAction,
    null
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: "500px", marginTop: "0.5rem" }}>
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
        <label htmlFor="divSelect" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
          Division:
        </label>
        <select id="divSelect" name="divisionId" className="input" style={{ width: "100%", padding: "0.5rem" }}>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="bracketName" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
          Tournament Name:
        </label>
        <input
          id="bracketName"
          name="name"
          type="text"
          defaultValue="Championship Playoffs"
          required
          className="input"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="playoffFormat" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Format:
          </label>
          <select id="playoffFormat" name="format" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            <option value="single_elimination">Single Elimination</option>
            <option value="best_of_3">Best-of-3 Series</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label htmlFor="teamCount" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Teams:
          </label>
          <select id="teamCount" name="teamCount" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            <option value="4">Top 4 Teams</option>
            <option value="2">Top 2 Teams (Final Only)</option>
            <option value="8">Top 8 Teams</option>
          </select>
        </div>
      </div>

      <div>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? "Seeding Bracket..." : "Generate Playoff Bracket"}
        </button>
      </div>
    </form>
  );
}

