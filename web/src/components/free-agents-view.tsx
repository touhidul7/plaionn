"use client";

import { useState, useTransition } from "react";
import {
  registerFreeAgentAction,
  postVacancyAction,
  applyVacancyAction,
  reviewApplicationAction,
  type ActionResult,
} from "@/app/(portal)/free-agents/actions";
import type { FreeAgentProfileItem, TeamVacancyItem } from "@/lib/free-agents-schema";

export interface PendingApplicationItem {
  id: string;
  vacancy_id: string;
  player_id: string;
  player_name: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface FreeAgentsViewProps {
  freeAgents: FreeAgentProfileItem[];
  vacancies: TeamVacancyItem[];
  pendingApplications?: PendingApplicationItem[];
  canManage: boolean;
  userPlayers: { id: string; name: string }[];
  teamEntries: { entry_id: string; name: string; division_name?: string }[];
  divisions: { id: string; name: string }[];
}

export function FreeAgentsView({
  freeAgents,
  vacancies,
  pendingApplications = [],
  canManage,
  userPlayers,
  teamEntries,
  divisions,
}: FreeAgentsViewProps) {
  const [activeTab, setActiveTab] = useState<"vacancies" | "directory">("vacancies");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("seeking");

  // Dialog States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPostVacancyModal, setShowPostVacancyModal] = useState(false);
  const [selectedVacancyForApply, setSelectedVacancyForApply] = useState<TeamVacancyItem | null>(null);

  // Transitions & Form Status
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const filteredAgents = freeAgents.filter((agent) => {
    if (positionFilter !== "all" && agent.preferred_position !== positionFilter && agent.preferred_position !== "any") {
      return false;
    }
    if (statusFilter !== "all" && agent.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
            feedback.success
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="icon-btn text-xs uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Free Agent & Tryout Discovery</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Connect unattached players with hockey teams needing skaters and goaltenders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userPlayers.length > 0 && (
            <button
              onClick={() => {
                setFeedback(null);
                setShowRegisterModal(true);
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
            >
              + Register as Free Agent
            </button>
          )}
          {canManage && (
            <button
              onClick={() => {
                setFeedback(null);
                setShowPostVacancyModal(true);
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-sm"
            >
              + Post Team Vacancy
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab("vacancies")}
          className={`tab-btn ${activeTab === "vacancies" ? "active" : ""}`}
        >
          Team Vacancies &amp; Openings ({vacancies.length})
        </button>
        <button
          onClick={() => setActiveTab("directory")}
          className={`tab-btn ${activeTab === "directory" ? "active" : ""}`}
        >
          Free Agent Pool ({freeAgents.length})
        </button>
      </div>

      {/* TAB 1: Team Vacancies */}
      {activeTab === "vacancies" && (
        <div className="space-y-6">
          {vacancies.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-white/5">
              <p className="text-zinc-400">No active team vacancies currently posted.</p>
              {canManage && (
                <p className="text-xs text-zinc-500 mt-1">
                  Commissioners can post team vacancies using the button above.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vacancies.map((v) => {
                const pendingForVacancy = pendingApplications.filter((a) => a.vacancy_id === v.vacancy_id);

                return (
                  <div
                    key={v.vacancy_id}
                    className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-cyan-300">
                            {v.division_name || "General"}
                          </span>
                          <h3 className="text-lg font-bold text-white mt-1.5">{v.team_name}</h3>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                          {v.spots_available} spot{v.spots_available > 1 ? "s" : ""} open
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 line-clamp-3 my-3 bg-black/30 p-2.5 rounded-lg border border-white/5">
                        {v.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className="text-[11px] text-zinc-400 self-center mr-1">Seeking:</span>
                        {v.needed_positions.map((pos) => (
                          <span
                            key={pos}
                            className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white"
                          >
                            {pos === "F" ? "Forward" : pos === "D" ? "Defense" : pos === "G" ? "Goalie" : pos}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 space-y-3">
                      {/* Apply button for players */}
                      {userPlayers.length > 0 && (
                        <button
                          onClick={() => {
                            setFeedback(null);
                            setSelectedVacancyForApply(v);
                          }}
                          className="w-full py-2 text-xs font-semibold rounded-lg bg-cyan-700/80 hover:bg-cyan-600 text-white transition-colors"
                        >
                          Apply for this Roster Spot
                        </button>
                      )}

                      {/* Commissioner applicant review */}
                      {canManage && pendingForVacancy.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5">
                          <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
                            Pending Applicants ({pendingForVacancy.length})
                          </p>
                          <div className="space-y-2">
                            {pendingForVacancy.map((app) => (
                              <div
                                key={app.id}
                                className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-2"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-white">{app.player_name}</span>
                                  <span className="text-[10px] text-zinc-400">
                                    {new Date(app.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {app.message && (
                                  <p className="text-[11px] text-zinc-300 italic">"{app.message}"</p>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    disabled={isPending}
                                    onClick={() => {
                                      startTransition(async () => {
                                        const fd = new FormData();
                                        fd.set("applicationId", app.id);
                                        fd.set("accept", "true");
                                        const res = await reviewApplicationAction(null, fd);
                                        setFeedback(res);
                                      });
                                    }}
                                    className="button button-sm primary flex-1"
                                  >
                                    Accept to Roster
                                  </button>
                                  <button
                                    disabled={isPending}
                                    onClick={() => {
                                      startTransition(async () => {
                                        const fd = new FormData();
                                        fd.set("applicationId", app.id);
                                        fd.set("accept", "false");
                                        const res = await reviewApplicationAction(null, fd);
                                        setFeedback(res);
                                      });
                                    }}
                                    className="button button-sm button-danger"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Free Agent Directory */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/40 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Position:</span>
              {(["all", "F", "D", "G"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`chip-btn ${positionFilter === pos ? "active" : ""}`}
                >
                  {pos === "all" ? "All" : pos === "F" ? "Forwards" : pos === "D" ? "Defense" : "Goalies"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Status:</span>
              {(["seeking", "placed", "all"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`chip-btn ${statusFilter === st ? "active" : ""}`}
                >
                  {st === "seeking" ? "Seeking Team" : st === "placed" ? "Placed" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {filteredAgents.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-white/5">
              <p className="text-zinc-400">No free agents found matching the selected filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.profile_id}
                  className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-base font-bold text-white">{agent.player_name}</h4>
                        <span className="text-xs text-cyan-300">
                          {agent.preferred_division_name
                            ? `Prefers: ${agent.preferred_division_name}`
                            : "Any Division"}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          agent.status === "seeking"
                            ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {agent.status === "seeking" ? "Seeking Team" : "Placed"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 my-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-zinc-200">
                        {agent.preferred_position === "F"
                          ? "Forward"
                          : agent.preferred_position === "D"
                          ? "Defense"
                          : agent.preferred_position === "G"
                          ? "Goalie"
                          : "Any Position"}
                      </span>
                      <span className="text-zinc-400">•</span>
                      <span className="text-zinc-300 font-medium">{agent.skill_level}</span>
                    </div>

                    {agent.bio && (
                      <p className="text-xs text-zinc-300 italic bg-black/30 p-2.5 rounded-lg border border-white/5 my-3">
                        "{agent.bio}"
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/5 text-[11px] text-zinc-500 flex justify-between">
                    <span>Listed: {new Date(agent.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Register Free Agent */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Register as Free Agent</h3>
              <button
                onClick={() => setShowRegisterModal(false)}
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
                  const res = await registerFreeAgentAction(null, fd);
                  setFeedback(res);
                  if (res.success) setShowRegisterModal(false);
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Select Player Identity</label>
                <select
                  name="playerId"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  {userPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Preferred Position</label>
                <select
                  name="position"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  <option value="F">Forward (F)</option>
                  <option value="D">Defense (D)</option>
                  <option value="G">Goaltender (G)</option>
                  <option value="any">Any Position</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Skill Level</label>
                <select
                  name="skillLevel"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  <option value="Recreational / Beginner">Recreational / Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Upper Intermediate">Upper Intermediate</option>
                  <option value="Competitive / Advanced">Competitive / Advanced</option>
                  <option value="Elite / Junior / NCAA">Elite / Junior / NCAA</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Preferred Division (Optional)</label>
                <select
                  name="preferredDivisionId"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  <option value="">No preference / Any division</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Bio / Playing Experience</label>
                <textarea
                  name="bio"
                  rows={3}
                  placeholder="e.g. 5 years rec league experience, reliable skater looking for regular team..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white placeholder-zinc-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="button button-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="button primary"
                >
                  {isPending ? "Publishing..." : "Publish Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Post Vacancy (Commissioner) */}
      {showPostVacancyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Post Team Vacancy</h3>
              <button
                onClick={() => setShowPostVacancyModal(false)}
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
                  const res = await postVacancyAction(null, fd);
                  setFeedback(res);
                  if (res.success) setShowPostVacancyModal(false);
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Select Team Entry</label>
                <select
                  name="teamEntryId"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  {teamEntries.map((t) => (
                    <option key={t.entry_id} value={t.entry_id}>
                      {t.name} {t.division_name ? `(${t.division_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Needed Positions</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-white/5 cursor-pointer">
                    <input type="checkbox" name="positions" value="F" defaultChecked className="rounded" />
                    <span>Forward</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-white/5 cursor-pointer">
                    <input type="checkbox" name="positions" value="D" defaultChecked className="rounded" />
                    <span>Defense</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-white/5 cursor-pointer">
                    <input type="checkbox" name="positions" value="G" className="rounded" />
                    <span>Goalie</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Open Spots</label>
                <input
                  type="number"
                  name="spotsAvailable"
                  min="1"
                  max="20"
                  defaultValue="2"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Description & Requirements</label>
                <textarea
                  name="description"
                  rows={3}
                  required
                  placeholder="e.g. Looking for 2 wingers with intermediate skills for Sunday evening games..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white placeholder-zinc-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPostVacancyModal(false)}
                  className="button button-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="button primary"
                >
                  {isPending ? "Posting..." : "Post Vacancy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Apply to Vacancy (Player) */}
      {selectedVacancyForApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Apply to {selectedVacancyForApply.team_name}
              </h3>
              <button
                onClick={() => setSelectedVacancyForApply(null)}
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
                  const res = await applyVacancyAction(null, fd);
                  setFeedback(res);
                  if (res.success) setSelectedVacancyForApply(null);
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="vacancyId" value={selectedVacancyForApply.vacancy_id} />

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Applying As Player</label>
                <select
                  name="playerId"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white"
                >
                  {userPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Message to Team Leadership (Optional)</label>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Introduce yourself, position preferred, previous team experience..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white placeholder-zinc-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedVacancyForApply(null)}
                  className="button button-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="button primary"
                >
                  {isPending ? "Submitting..." : "Send Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

