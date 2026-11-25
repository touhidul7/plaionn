"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ScheduleImporter } from "@/components/schedule-importer";
import { SetupForm } from "@/components/setup-form";
import { SeasonSettingsForm } from "@/components/season-settings-form";

export interface LeagueAdminData {
  league: {
    id: string;
    name: string;
    season?: string;
    teams?: number;
  };
  seasons: { id: string; name: string }[];
  divisions: { id: string; name: string; season_name: string; season_id: string }[];
  teams: { id: string; entry_id: string; name: string; division_name: string; season_name: string }[];
  games: {
    id: string;
    starts_at: string;
    status: string;
    home_name: string;
    away_name: string;
    rink_name: string;
  }[];
  venues: any[];
  rinks: any[];
  staff: { user_id: string; email: string; role: string }[];
  settings?: any;
}

interface LeagueAdminShellProps {
  data: LeagueAdminData;
  initialTab?: string;
  children?: React.ReactNode;
}

export function LeagueAdminShell({ data, initialTab = "overview", children }: LeagueAdminShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || initialTab;

  const { league, seasons, divisions, teams, games, venues, rinks, staff, settings } = data;

  const entriesForSchedule = teams.map((t) => ({
    id: t.entry_id,
    team_id: t.id,
    division_id: divisions.find((d) => d.name === t.division_name)?.id || "",
    label: `${t.name} (${t.division_name})`,
  }));

  const navItems = [
    { key: "overview", label: "HQ Overview", icon: "📊" },
    { key: "seasons", label: "Seasons & Divisions", icon: "🏆", badge: seasons.length },
    { key: "teams", label: "Teams & Rosters", icon: "👥", badge: teams.length },
    { key: "schedule", label: "Schedule & Fixtures", icon: "📅", badge: games.length },
    { key: "gamecentre", label: "Game Centre & Scores", icon: "⏱️" },
    { key: "registrations", label: "Registrations & Waivers", icon: "📝" },
    { key: "governance", label: "Staff & Governance", icon: "🛡️", badge: staff.length },
    { key: "settings", label: "League Settings & Domain", icon: "⚙️" },
  ];

  const setTab = (key: string) => {
    router.push(`/admin/league/${league.id}?tab=${key}`);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
        background: "#060d13",
        color: "#f0f4f8",
      }}
    >
      {/* 1. Instantly-Style Sticky Left Sidebar */}
      <aside
        style={{
          background: "#091219",
          borderRight: "1px solid #162634",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          height: "100vh",
          padding: "20px 16px",
          zIndex: 40,
        }}
      >
        <div>
          {/* League Brand Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingBottom: "16px",
              borderBottom: "1px solid #162634",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--lime)",
                color: "#081017",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "19px",
                flexShrink: 0,
              }}
            >
              {league.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "10.5px",
                  fontWeight: 800,
                  letterSpacing: "1.2px",
                  color: "var(--lime)",
                  textTransform: "uppercase",
                }}
              >
                LEAGUE CONSOLE
              </div>
              <h1
                style={{
                  margin: "1px 0 0",
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#f0f4f8",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {league.name}
              </h1>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? "#081017" : "#cbd5e1",
                    background: isActive ? "var(--lime)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "15px" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        fontWeight: 700,
                        background: isActive ? "#081017" : "rgba(255,255,255,0.1)",
                        color: isActive ? "var(--lime)" : "var(--muted)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Platform Controls & View Public */}
        <div style={{ borderTop: "1px solid #162634", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <a
            href={`/api/switch-league?league=${league.id}&redirect=%2F`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <span>🌐</span>
            <span>View Public League Site ↗</span>
          </a>

          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <span>⚙️</span>
            <span>Platform Admin / All Leagues</span>
          </Link>
        </div>
      </aside>

      {/* 2. Main Console Content Area */}
      <main style={{ padding: "32px 40px", maxWidth: "1280px", width: "100%", margin: "0 auto" }}>
        {/* Top Control Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px", textTransform: "uppercase" }}>
                {league.name} · MANAGEMENT CONSOLE
              </span>
              <span className="badge" style={{ fontSize: "10px" }}>
                ACTIVE COMMISSIONER
              </span>
            </div>
            <h2 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 800, color: "#f0f4f8" }}>
              {navItems.find((n) => n.key === activeTab)?.label ?? "HQ Overview"}
            </h2>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <ScheduleImporter
              leagueId={league.id}
              entries={entriesForSchedule}
              venues={venues}
              rinks={rinks}
            />
            <Link
              href={`/api/switch-league?league=${league.id}&redirect=%2Fschedule`}
              className="button button-sm button-outline"
              style={{ fontSize: "12.5px" }}
            >
              Public Schedule ↗
            </Link>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Registered Teams</span>
                <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--lime)", marginTop: "4px" }}>
                  {teams.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Across {divisions.length} divisions</span>
              </div>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Scheduled Matches</span>
                <div style={{ fontSize: "28px", fontWeight: 900, color: "#f0f4f8", marginTop: "4px" }}>
                  {games.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>In active calendar</span>
              </div>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Active Seasons</span>
                <div style={{ fontSize: "28px", fontWeight: 900, color: "#60a5fa", marginTop: "4px" }}>
                  {seasons.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Configured competitions</span>
              </div>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Governance &amp; Officials</span>
                <div style={{ fontSize: "28px", fontWeight: 900, color: "#34d399", marginTop: "4px" }}>
                  {staff.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Referees &amp; timekeepers</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "17px", color: "#f0f4f8" }}>
                Commissioner Quick Actions
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setTab("schedule")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "12px 16px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: "var(--lime)" }}>📥 Import Match Schedule</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Upload CSV / Excel fixtures</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("teams")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "12px 16px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: "var(--lime)" }}>👥 Team Rosters &amp; Invites</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Pending spots &amp; WhatsApp links</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("seasons")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "12px 16px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: "var(--lime)" }}>🏆 Seasons &amp; Divisions</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Configure league structure</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "12px 16px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: "var(--lime)" }}>⚙️ Custom Domain &amp; Rules</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Domain setup &amp; points rules</span>
                </button>
              </div>
            </div>

            {/* Upcoming Games Quick View */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#f0f4f8" }}>
                  Upcoming Games &amp; Rink Bookings
                </span>
                <button type="button" onClick={() => setTab("schedule")} style={{ background: "none", border: "none", color: "var(--lime)", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  View All ({games.length}) →
                </button>
              </div>
              {games.length > 0 ? (
                <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "140px" }}>START TIME</th>
                      <th>MATCHUP</th>
                      <th>RINK / VENUE</th>
                      <th style={{ width: "110px", textAlign: "right" }}>STATUS</th>
                      <th style={{ width: "120px", textAlign: "right" }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.slice(0, 6).map((g) => (
                      <tr key={g.id}>
                        <td>{new Date(g.starts_at).toLocaleDateString()} · {new Date(g.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td><strong>{g.away_name}</strong> @ <strong>{g.home_name}</strong></td>
                        <td style={{ color: "var(--muted)" }}>{g.rink_name}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="badge" style={{ fontSize: "10px" }}>{g.status.toUpperCase()}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/schedule/${g.id}/live`} className="button button-sm button-outline" style={{ fontSize: "11px", padding: "3px 8px" }}>
                            Score Game ↗
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                  No games scheduled yet. Use the Bulk Importer or Schedule tab to add games.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Seasons & Divisions Tab */}
        {activeTab === "seasons" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="cards">
              <SetupForm kind="season" title="1. Start a season" />
              <SetupForm kind="division" title="2. Add a division" parentLabel="Season" parents={seasons} />
              <SetupForm kind="team" title="3. Add a team" parentLabel="Division" parents={divisions.map(d => ({ id: d.id, name: `${d.season_name} · ${d.name}` }))} />
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "16px" }}>Configured Competition Hierarchy</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                {divisions.map((div) => (
                  <div key={div.id} style={{ background: "#081017", border: "1px solid #162634", borderRadius: "10px", padding: "14px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>{div.season_name}</span>
                    <h4 style={{ margin: "2px 0 6px", fontSize: "15px", color: "var(--lime)" }}>{div.name}</h4>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {teams.filter(t => t.division_name === div.name).length} teams registered
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Teams & Rosters Tab */}
        {activeTab === "teams" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#f0f4f8" }}>League Teams Directory</h3>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Manage rosters, pending spots, and captain claim tokens</span>
                </div>
                <span className="badge" style={{ fontSize: "11px" }}>{teams.length} Teams</span>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>TEAM NAME</th>
                    <th>DIVISION</th>
                    <th>SEASON</th>
                    <th style={{ width: "240px", textAlign: "right" }}>ROSTER ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id}>
                      <td><strong style={{ fontSize: "14px", color: "#f0f4f8" }}>{t.name}</strong></td>
                      <td><span className="badge" style={{ fontSize: "11px" }}>{t.division_name}</span></td>
                      <td style={{ color: "var(--muted)" }}>{t.season_name}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <Link href={`/teams/${t.entry_id}`} className="button button-sm button-outline" style={{ fontSize: "11.5px" }}>
                            👥 Manage Roster
                          </Link>
                          <a
                            href={`/teams/join?team=${t.entry_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-sm button-outline"
                            style={{ fontSize: "11.5px" }}
                            title="Shareable invite link"
                          >
                            🔗 Invite
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule & Fixtures Tab */}
        {activeTab === "schedule" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px" }}>Import and Schedule Fixtures</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
                  Use the Bulk Importer for CSV / Excel or manage individual game slots.
                </p>
              </div>
              <ScheduleImporter
                leagueId={league.id}
                entries={entriesForSchedule}
                venues={venues}
                rinks={rinks}
              />
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #162634" }}>
                <h3 style={{ margin: 0, fontSize: "15px" }}>Scheduled Match Fixtures ({games.length})</h3>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "150px" }}>DATE &amp; TIME</th>
                    <th>HOME TEAM</th>
                    <th>AWAY TEAM</th>
                    <th>ARENA / RINK</th>
                    <th style={{ width: "100px", textAlign: "right" }}>STATUS</th>
                    <th style={{ width: "120px", textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.id}>
                      <td>{new Date(g.starts_at).toLocaleDateString()} · {new Date(g.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td><strong>{g.home_name}</strong></td>
                      <td><strong>{g.away_name}</strong></td>
                      <td style={{ color: "var(--muted)" }}>{g.rink_name}</td>
                      <td style={{ textAlign: "right" }}><span className="badge" style={{ fontSize: "10px" }}>{g.status.toUpperCase()}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/schedule/${g.id}/live`} className="button button-sm button-outline" style={{ fontSize: "11px" }}>
                          Score Game ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Game Centre & Scores Tab */}
        {activeTab === "gamecentre" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "17px" }}>Digital Scorekeeper Console</h3>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)" }}>
                Launch the official digital rink scorekeeper app for live goal tracking, penalties, lineups, and three-star selections.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                {games.slice(0, 4).map((g) => (
                  <div key={g.id} style={{ background: "#081017", border: "1px solid #162634", borderRadius: "10px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                      <span>{g.rink_name}</span>
                      <span className="badge" style={{ fontSize: "9px" }}>{g.status.toUpperCase()}</span>
                    </div>
                    <h4 style={{ margin: "8px 0", fontSize: "15px" }}>{g.away_name} vs {g.home_name}</h4>
                    <Link href={`/schedule/${g.id}/live`} className="button button-sm primary" style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}>
                      ⏱️ Open Scorekeeper Console
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Registrations & Waivers Tab */}
        {activeTab === "registrations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "17px" }}>Player Registrations &amp; GoHighLevel Waivers</h3>
              <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--muted)" }}>
                Track signed digital liability waivers, payment clearances, and player onboarding status across the league.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#facc15" }}>🟡 Invited / Pending</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "4px" }}>18</div>
                </div>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#fb923c" }}>🟠 Waiver Needed</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "4px" }}>7</div>
                </div>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#60a5fa" }}>🔵 Payment Due</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "4px" }}>4</div>
                </div>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#34d399" }}>🟢 Cleared to Play</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "4px" }}>82</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Staff & Governance Tab */}
        {activeTab === "governance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px" }}>League Staff &amp; Officials</h3>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Commissioners, referees, timekeepers, and assignors</span>
                </div>
                <span className="badge">{staff.length} Active Staff</span>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th style={{ textAlign: "right" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.user_id || s.email}>
                      <td><strong>{s.email}</strong></td>
                      <td><span className="badge" style={{ fontSize: "11px" }}>{s.role.toUpperCase()}</span></td>
                      <td style={{ textAlign: "right" }}><span style={{ color: "#34d399", fontSize: "12px" }}>Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* League Settings & Custom Domain Tab */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "17px" }}>Custom Domain &amp; White-label Branding</h3>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)" }}>
                Route your custom domain (e.g. <code>alaskaleague.com</code> or <code>bhl.com</code>) directly to your branded portal.
              </p>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", maxWidth: "600px" }}>
                <input
                  type="text"
                  defaultValue={`${league.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`}
                  style={{
                    flex: 1,
                    background: "#081017",
                    border: "1px solid #162634",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#f0f4f8",
                    fontSize: "13.5px",
                  }}
                />
                <button type="button" className="button primary" style={{ fontWeight: 800 }}>
                  Save Custom Domain
                </button>
              </div>
            </div>

            {settings && (
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "17px" }}>Season Rules &amp; Competition Format</h3>
                <SeasonSettingsForm
                  settings={settings}
                  seasonId={settings.season_id || seasons[0]?.id || ""}
                  canManage={true}
                />
              </div>
            )}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
