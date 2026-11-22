"use client";

import { useState, useTransition } from "react";
import {
  recordPeriodShotsAction,
  recordGoalieStintAction,
  type ActionResult,
} from "@/app/(portal)/schedule/[gameId]/scorekeeping/shots-actions";
import type { GameShotsSummary } from "@/lib/shots-schema";
import { sanitizePlayerName } from "@/lib/sanitize";

interface ShotsAndGoalieBoxscoreProps {
  summary: GameShotsSummary;
  canScore?: boolean;
  homeRosterGoalies?: { id: string; name: string }[];
  awayRosterGoalies?: { id: string; name: string }[];
}

export function ShotsAndGoalieBoxscore({
  summary,
  canScore = false,
  homeRosterGoalies = [],
  awayRosterGoalies = [],
}: ShotsAndGoalieBoxscoreProps) {
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dialog State for Goalie Stint Form
  const [showGoalieModal, setShowGoalieModal] = useState(false);
  const [selectedTeamEntry, setSelectedTeamEntry] = useState<string>(summary.home_entry_id);

  const homeShots = summary.period_shots.find((s) => s.team_entry_id === summary.home_entry_id) || {
    p1: 0,
    p2: 0,
    p3: 0,
    ot: 0,
    total: 0,
  };

  const awayShots = summary.period_shots.find((s) => s.team_entry_id === summary.away_entry_id) || {
    p1: 0,
    p2: 0,
    p3: 0,
    ot: 0,
    total: 0,
  };

  const activeGoaliesList =
    selectedTeamEntry === summary.home_entry_id ? homeRosterGoalies : awayRosterGoalies;

  return (
    <section className="space-y-6 rounded-2xl bg-zinc-900/50 border border-white/10 p-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.success
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="icon-btn text-[10px] uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Shots on Goal Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Shots on Goal &amp; Period Breakdown</h3>
          <p className="text-xs text-zinc-400">Official shots registered by period.</p>
        </div>
      </div>

      {/* SOG Period Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-white/5 uppercase tracking-wider text-[11px] text-zinc-400 font-semibold border-b border-white/10">
            <tr>
              <th className="px-4 py-2.5">Team</th>
              <th className="px-3 py-2.5 text-center">1st</th>
              <th className="px-3 py-2.5 text-center">2nd</th>
              <th className="px-3 py-2.5 text-center">3rd</th>
              <th className="px-3 py-2.5 text-center">OT</th>
              <th className="px-4 py-2.5 text-center font-bold text-white">Total SOG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {/* Home Team */}
            <tr>
              <td className="px-4 py-3 font-semibold text-white">{summary.home_name}</td>
              <td className="px-3 py-3 text-center font-mono">{homeShots.p1}</td>
              <td className="px-3 py-3 text-center font-mono">{homeShots.p2}</td>
              <td className="px-3 py-3 text-center font-mono">{homeShots.p3}</td>
              <td className="px-3 py-3 text-center font-mono">{homeShots.ot}</td>
              <td className="px-4 py-3 text-center font-mono font-bold text-cyan-300 text-sm">
                {homeShots.total}
              </td>
            </tr>
            {/* Away Team */}
            <tr>
              <td className="px-4 py-3 font-semibold text-white">{summary.away_name}</td>
              <td className="px-3 py-3 text-center font-mono">{awayShots.p1}</td>
              <td className="px-3 py-3 text-center font-mono">{awayShots.p2}</td>
              <td className="px-3 py-3 text-center font-mono">{awayShots.p3}</td>
              <td className="px-3 py-3 text-center font-mono">{awayShots.ot}</td>
              <td className="px-4 py-3 text-center font-mono font-bold text-cyan-300 text-sm">
                {awayShots.total}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Interactive Period Shot Entry (For Officials & Commissioners) */}
      {canScore && (
        <div style={{ padding: "16px 20px", borderRadius: "12px", background: "rgba(10, 20, 28, 0.7)", border: "1px solid var(--line)" }}>
          <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 800, color: "#67e8f9", letterSpacing: "1px", textTransform: "uppercase" }}>
            Quick Shot Update
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await recordPeriodShotsAction(null, fd);
                setFeedback(res);
              });
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <input type="hidden" name="gameId" value={summary.game_id} />
            
            <div style={{ minWidth: "170px", flex: "1 1 200px", maxWidth: "260px" }}>
              <select
                name="teamEntryId"
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "#12222e",
                  border: "1px solid var(--line)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <option value={summary.home_entry_id}>{summary.home_name}</option>
                <option value={summary.away_entry_id}>{summary.away_name}</option>
              </select>
            </div>

            <div style={{ minWidth: "130px", flex: "1 1 140px", maxWidth: "180px" }}>
              <select
                name="period"
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "#12222e",
                  border: "1px solid var(--line)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <option value="1">1st Period</option>
                <option value="2">2nd Period</option>
                <option value="3">3rd Period</option>
                <option value="4">Overtime</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="shotInput" style={{ color: "var(--muted)", fontSize: "12.5px", fontWeight: 700 }}>
                SOG:
              </label>
              <input
                id="shotInput"
                type="number"
                name="shots"
                min="0"
                max="150"
                defaultValue="10"
                required
                style={{
                  width: "68px",
                  height: "38px",
                  padding: "6px 8px",
                  borderRadius: "8px",
                  background: "#12222e",
                  border: "1px solid var(--line)",
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="button button-sm primary"
              style={{
                height: "38px",
                padding: "0 18px",
                fontWeight: 800,
                fontSize: "13px",
              }}
            >
              {isPending ? "Updating..." : "Update Shots"}
            </button>
          </form>
        </div>
      )}

      {/* Goalie Boxscore Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">Goaltending Boxscore &amp; Decisions</h4>
            <p className="text-xs text-zinc-400">Shots against, saves, save percentage, and game decisions.</p>
          </div>
          {canScore && (
            <button
              onClick={() => {
                setFeedback(null);
                setShowGoalieModal(true);
              }}
              className="button button-sm primary"
            >
              + Log Goalie Stint
            </button>
          )}
        </div>

        {summary.goalies.length === 0 ? (
          <div className="p-4 text-center rounded-xl bg-black/30 border border-white/5 text-zinc-500 text-xs">
            No goaltender appearances recorded yet for this matchup.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-white/5 uppercase tracking-wider text-[11px] text-zinc-400 font-semibold border-b border-white/10">
                <tr>
                  <th className="px-4 py-2.5">Goaltender</th>
                  <th className="px-3 py-2.5">Team</th>
                  <th className="px-3 py-2.5 text-center">Shots (SA)</th>
                  <th className="px-3 py-2.5 text-center">Goals (GA)</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-white">Saves (SV)</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-cyan-300">Save %</th>
                  <th className="px-4 py-2.5 text-center">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {summary.goalies.map((g) => (
                  <tr key={g.stint_id}>
                    <td className="px-4 py-2.5 font-sans font-semibold text-white">
                      {sanitizePlayerName(g.player_name)}
                      {g.is_empty_net && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-500/20">
                          Empty Net
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-sans text-zinc-400">{g.team_name}</td>
                    <td className="px-3 py-2.5 text-center">{g.shots_against}</td>
                    <td className="px-3 py-2.5 text-center text-rose-300">{g.goals_against}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-300">{g.saves}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-cyan-300">
                      {g.save_percentage.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.decision === "W"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : g.decision === "L"
                            ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                            : g.decision === "OTL"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {g.decision || "ND"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Log Goalie Stint (Officials & Commissioners) */}
      {showGoalieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Log Goaltender Appearance</h3>
              <button
                onClick={() => setShowGoalieModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await recordGoalieStintAction(null, fd);
                  setFeedback(res);
                  if (res.success) setShowGoalieModal(false);
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="gameId" value={summary.game_id} />

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Select Team</label>
                <select
                  name="teamEntryId"
                  value={selectedTeamEntry}
                  onChange={(e) => setSelectedTeamEntry(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  <option value={summary.home_entry_id}>{summary.home_name} (Home)</option>
                  <option value={summary.away_entry_id}>{summary.away_name} (Away)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Select Goaltender</label>
                <select
                  name="goalieId"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  {activeGoaliesList.length === 0 ? (
                    <option value="60000000-0000-4000-8000-000000000101">Primary Goaltender (#30)</option>
                  ) : (
                    activeGoaliesList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Shots Faced (SA)</label>
                  <input
                    type="number"
                    name="shotsFaced"
                    min="0"
                    max="150"
                    defaultValue="25"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Goals Allowed (GA)</label>
                  <input
                    type="number"
                    name="goalsAllowed"
                    min="0"
                    max="50"
                    defaultValue="2"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Goalie Decision</label>
                <select
                  name="decision"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  <option value="W">Win (W)</option>
                  <option value="L">Loss (L)</option>
                  <option value="OTL">Overtime / Shootout Loss (OTL)</option>
                  <option value="ND">No Decision (ND)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGoalieModal(false)}
                  className="button button-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="button primary"
                >
                  {isPending ? "Saving..." : "Save Appearance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

