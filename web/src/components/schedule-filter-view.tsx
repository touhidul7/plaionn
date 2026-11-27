"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { sanitizeVenueName } from "@/lib/sanitize";

export interface ScheduleItem {
  game_id: string;
  season_id?: string;
  season_name?: string;
  division_id?: string;
  division_name?: string;
  home_entry_id?: string;
  home_team_name: string;
  away_entry_id?: string;
  away_team_name: string;
  venue_name: string;
  rink_name?: string;
  time_zone?: string;
  starts_at: string;
  ends_at?: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  decision: string | null;
}

interface ScheduleFilterViewProps {
  games: ScheduleItem[];
  leagueName: string;
  leagueId: string;
  canManage?: boolean;
}

export function ScheduleFilterView({ games, leagueName, leagueId, canManage }: ScheduleFilterViewProps) {
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [filterView, setFilterView] = useState<"all" | "final" | "upcoming">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Extract unique filter options
  const divisions = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      if (g.division_name) set.add(g.division_name);
    });
    return Array.from(set).sort();
  }, [games]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      if (g.home_team_name) set.add(g.home_team_name);
      if (g.away_team_name) set.add(g.away_team_name);
    });
    return Array.from(set).sort();
  }, [games]);

  const venues = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      const v = g.venue_name ? sanitizeVenueName(g.venue_name) : "";
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [games]);

  // Apply filters
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      const isFinal = g.home_score !== null && g.away_score !== null;

      if (filterView === "final" && !isFinal) return false;
      if (filterView === "upcoming" && isFinal) return false;

      if (selectedDivision !== "all" && g.division_name !== selectedDivision) return false;

      if (selectedTeam !== "all" && g.home_team_name !== selectedTeam && g.away_team_name !== selectedTeam) {
        return false;
      }

      if (selectedVenue !== "all" && sanitizeVenueName(g.venue_name) !== selectedVenue) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          g.home_team_name.toLowerCase().includes(q) ||
          g.away_team_name.toLowerCase().includes(q) ||
          (g.venue_name && g.venue_name.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [games, filterView, selectedDivision, selectedTeam, selectedVenue, searchQuery]);

  const finalGames = useMemo(() => {
    return filteredGames.filter((g) => g.home_score !== null && g.away_score !== null);
  }, [filteredGames]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Multi-Dropdown Filter Bar (theScore Style) */}
      <div
        style={{
          background: "#0c1822",
          border: "1px solid #1f394d",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
          {/* Division Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
              Division
            </label>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              style={{
                background: "#081017",
                border: "1px solid #1f394d",
                color: "var(--text)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <option value="all">All Divisions ({divisions.length})</option>
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
              Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              style={{
                background: "#081017",
                border: "1px solid #1f394d",
                color: "var(--text)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <option value="all">All Teams ({teams.length})</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Venue / Rink Filter */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
              Venue / Rink
            </label>
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              style={{
                background: "#081017",
                border: "1px solid #1f394d",
                color: "var(--text)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <option value="all">All Arenas &amp; Rinks</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Search box */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
              Search Matchup
            </label>
            <input
              type="text"
              placeholder="Filter team name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "#081017",
                border: "1px solid #1f394d",
                color: "var(--text)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12.5px",
              }}
            />
          </div>
        </div>

        {/* View Toggle Buttons */}
        <div style={{ display: "flex", gap: "4px", background: "#081017", padding: "4px", borderRadius: "10px", border: "1px solid #1f394d", alignSelf: "flex-end" }}>
          <button
            type="button"
            onClick={() => setFilterView("all")}
            style={{
              background: filterView === "all" ? "var(--lime)" : "transparent",
              color: filterView === "all" ? "#081017" : "var(--muted)",
              fontWeight: 700,
              fontSize: "12px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            All Games ({games.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterView("final")}
            style={{
              background: filterView === "final" ? "var(--lime)" : "transparent",
              color: filterView === "final" ? "#081017" : "var(--muted)",
              fontWeight: 700,
              fontSize: "12px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Final Scores
          </button>
          <button
            type="button"
            onClick={() => setFilterView("upcoming")}
            style={{
              background: filterView === "upcoming" ? "var(--lime)" : "transparent",
              color: filterView === "upcoming" ? "#081017" : "var(--muted)",
              fontWeight: 700,
              fontSize: "12px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Upcoming
          </button>
        </div>
      </div>

      {/* 2. theScore Recent Scoreboard Cards Grid */}
      {filterView !== "upcoming" && finalGames.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text)" }}>
              Recent Match Results ({finalGames.length})
            </h3>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Official Scoresheet Confirmed
            </span>
          </div>

          <div className="scoreboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {finalGames.slice(0, 6).map((game) => {
              const homeScore = game.home_score ?? 0;
              const awayScore = game.away_score ?? 0;
              const homeWon = homeScore > awayScore;
              const awayWon = awayScore > homeScore;
              const time = new Date(game.starts_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });

              return (
                <article
                  key={game.game_id}
                  style={{
                    background: "#0c1822",
                    border: "1px solid #1f394d",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "#34d399",
                        background: "rgba(16, 185, 129, 0.12)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      FINAL{game.decision && game.decision !== "regulation" ? ` (${game.decision.toUpperCase()})` : ""}
                    </span>
                    <span style={{ color: "var(--muted)" }}>{time}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {game.home_entry_id ? (
                        <Link
                          href={`/teams/${game.home_entry_id}`}
                          style={{
                            fontWeight: homeWon ? 700 : 500,
                            color: homeWon ? "var(--text)" : "var(--muted)",
                            fontSize: "13.5px",
                            textDecoration: "none",
                          }}
                        >
                          {game.home_team_name}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: homeWon ? 700 : 500, color: homeWon ? "var(--text)" : "var(--muted)", fontSize: "13.5px" }}>
                          {game.home_team_name}
                        </span>
                      )}
                      <strong style={{ fontSize: "15px", color: homeWon ? "var(--lime)" : "var(--text)" }}>
                        {homeScore}
                      </strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {game.away_entry_id ? (
                        <Link
                          href={`/teams/${game.away_entry_id}`}
                          style={{
                            fontWeight: awayWon ? 700 : 500,
                            color: awayWon ? "var(--text)" : "var(--muted)",
                            fontSize: "13.5px",
                            textDecoration: "none",
                          }}
                        >
                          {game.away_team_name}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: awayWon ? 700 : 500, color: awayWon ? "var(--text)" : "var(--muted)", fontSize: "13.5px" }}>
                          {game.away_team_name}
                        </span>
                      )}
                      <strong style={{ fontSize: "15px", color: awayWon ? "var(--lime)" : "var(--text)" }}>
                        {awayScore}
                      </strong>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {sanitizeVenueName(game.venue_name)}
                    </span>
                    <Link
                      href={`/schedule/${game.game_id}/live`}
                      className="button button-sm button-outline"
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                    >
                      Boxscore →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Filtered Fixtures & Results Table (theScore Aesthetics) */}
      <section
        style={{
          background: "#0c1822",
          border: "1px solid #1f394d",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #1f394d",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>
            Full Fixtures &amp; Official Results ({filteredGames.length} matches)
          </span>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            Showing {filteredGames.length} of {games.length} total
          </span>
        </div>

        {filteredGames.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
              <thead>
                <tr>
                  <th style={{ width: "135px" }}>DATE &amp; TIME</th>
                  <th>HOME TEAM</th>
                  <th style={{ width: "30px", textAlign: "center" }}>VS</th>
                  <th>AWAY TEAM</th>
                  <th>VENUE / RINK</th>
                  <th style={{ width: "100px", textAlign: "center" }}>STATUS</th>
                  <th style={{ width: "110px", textAlign: "right" }}>SCORE</th>
                  <th style={{ width: "110px", textAlign: "right" }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((game) => {
                  const isFinal = game.home_score !== null && game.away_score !== null;
                  const dateStr = new Date(game.starts_at).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const timeStr = new Date(game.starts_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={game.game_id}>
                      <td>
                        <span style={{ fontWeight: 700, color: "var(--text)", display: "block" }}>{dateStr}</span>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>{timeStr}</span>
                      </td>
                      <td>
                        {game.home_entry_id ? (
                          <Link
                            href={`/teams/${game.home_entry_id}`}
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: isFinal && (game.home_score ?? 0) > (game.away_score ?? 0) ? "var(--lime)" : "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {game.home_team_name}
                          </Link>
                        ) : (
                          <span style={{ fontSize: "13px", fontWeight: 700, color: isFinal && (game.home_score ?? 0) > (game.away_score ?? 0) ? "var(--lime)" : "var(--text)" }}>
                            {game.home_team_name}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>vs</td>
                      <td>
                        {game.away_entry_id ? (
                          <Link
                            href={`/teams/${game.away_entry_id}`}
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: isFinal && (game.away_score ?? 0) > (game.home_score ?? 0) ? "var(--lime)" : "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {game.away_team_name}
                          </Link>
                        ) : (
                          <span style={{ fontSize: "13px", fontWeight: 700, color: isFinal && (game.away_score ?? 0) > (game.home_score ?? 0) ? "var(--lime)" : "var(--text)" }}>
                            {game.away_team_name}
                          </span>
                        )}
                      </td>
                      <td>
                        <span>{sanitizeVenueName(game.venue_name)}</span>
                        <small style={{ display: "block", color: "var(--muted)" }}>{game.rink_name ?? "Rink 1"}</small>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isFinal ? (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            FINAL
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: "10px" }}>
                            {game.status.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isFinal ? (
                          <Link
                            href={`/schedule/${game.game_id}/live`}
                            style={{ fontWeight: 800, fontSize: "13.5px", color: "var(--lime)", textDecoration: "none" }}
                            title="View boxscore game summary"
                          >
                            {game.home_score} – {game.away_score}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/schedule/${game.game_id}/live`}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        >
                          {isFinal ? "Boxscore" : "Live Game"} ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "36px", textAlign: "center", color: "var(--muted)" }}>
            No matches match the selected filter criteria.
          </div>
        )}
      </section>
    </div>
  );
}
