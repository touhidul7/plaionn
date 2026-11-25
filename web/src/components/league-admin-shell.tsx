"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ScheduleImporter } from "@/components/schedule-importer";
import { SetupForm } from "@/components/setup-form";
import { SeasonSettingsForm } from "@/components/season-settings-form";
import {
  addStaffMemberAction,
  removeStaffMemberAction,
  saveLeagueDomainAction,
} from "@/app/(portal)/admin/league/[leagueId]/admin-actions";

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
  registrations: { id: string; playerName: string; position: string; status: string; createdAt: string }[];
  rosterCount: number;
  overridesCount: number;
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

  const {
    league,
    seasons,
    divisions,
    teams,
    games,
    venues,
    rinks,
    staff,
    registrations,
    rosterCount,
    overridesCount,
    settings,
  } = data;

  // Staff form state
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState("commissioner");
  const [isStaffPending, setIsStaffPending] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Domain form state
  const [domainInput, setDomainInput] = useState(
    `${league.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`
  );
  const [isDomainPending, setIsDomainPending] = useState(false);
  const [domainMsg, setDomainMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    { key: "registrations", label: "Registrations & Waivers", icon: "📝", badge: registrations.length },
    { key: "governance", label: "Staff & Governance", icon: "🛡️", badge: staff.length },
    { key: "settings", label: "League Settings & Domain", icon: "⚙️" },
  ];

  const setTab = (key: string) => {
    router.push(`/admin/league/${league.id}?tab=${key}`);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim()) return;

    setIsStaffPending(true);
    setStaffMsg(null);

    const res = await addStaffMemberAction({
      leagueId: league.id,
      email: staffEmail.trim(),
      role: staffRole,
    });

    setIsStaffPending(false);
    if (res.success) {
      setStaffEmail("");
      setStaffMsg({ type: "success", text: res.message });
    } else {
      setStaffMsg({ type: "error", text: res.message });
    }
  };

  const handleRemoveStaff = async (userId: string, role: string) => {
    setIsStaffPending(true);
    setStaffMsg(null);
    const res = await removeStaffMemberAction({ leagueId: league.id, userId, role });
    setIsStaffPending(false);
    if (res.success) {
      setStaffMsg({ type: "success", text: res.message });
    } else {
      setStaffMsg({ type: "error", text: res.message });
    }
  };

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDomainPending(true);
    setDomainMsg(null);
    const res = await saveLeagueDomainAction({ leagueId: league.id, domain: domainInput });
    setIsDomainPending(false);
    if (res.success) {
      setDomainMsg({ type: "success", text: res.message });
    } else {
      setDomainMsg({ type: "error", text: res.message });
    }
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

        {/* Sidebar Footer */}
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
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Manage rosters &amp; WhatsApp links</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("seasons")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "12px 16px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: "var(--lime)" }}>🏆 Seasons &amp; Divisions</strong>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Configure competition structure</span>
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
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Manage active rosters, claim tokens, and clearance pipeline</span>
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

        {/* Registrations & Waivers Tab (Real Database Records) */}
        {activeTab === "registrations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "17px" }}>Player Registrations &amp; Liability Waivers</h3>
              <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--muted)" }}>
                Live database clearance metrics from <code>player_registrations</code> and <code>player_eligibility_overrides</code>.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "var(--lime)" }}>👥 Total Team Rosters</span>
                  <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>{rosterCount}</div>
                </div>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#34d399" }}>🟢 Cleared to Play</span>
                  <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
                    {overridesCount + registrations.filter(r => r.status === 'approved').length}
                  </div>
                </div>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#fb923c" }}>🟠 Waiver Needed</span>
                  <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>
                    {registrations.filter(r => r.status === 'pending').length}
                  </div>
                </div>
                <div style={{ background: "#081017", padding: "16px", borderRadius: "10px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11.5px", color: "#60a5fa" }}>📝 Total Registrations</span>
                  <div style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>{registrations.length}</div>
                </div>
              </div>
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #162634" }}>
                <h3 style={{ margin: 0, fontSize: "15px" }}>Registered Players ({registrations.length})</h3>
              </div>
              {registrations.length > 0 ? (
                <table className="table" style={{ width: "100%", margin: 0, fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th>PLAYER</th>
                      <th>POSITION</th>
                      <th>REGISTERED AT</th>
                      <th style={{ textAlign: "right" }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.playerName}</strong></td>
                        <td>{r.position}</td>
                        <td style={{ color: "var(--muted)" }}>{r.createdAt}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="badge" style={{ fontSize: "10.5px" }}>{r.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                  No player self-registrations recorded in the database yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Staff & Governance Tab */}
        {activeTab === "governance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Add Staff Member Form */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>Invite or Assign Staff Member</h3>
              <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--muted)" }}>
                Assign Commissioners, Referees, and Timekeepers for {league.name}.
              </p>

              <form onSubmit={handleAddStaff} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: "240px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Staff Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="official@example.com"
                    style={{
                      width: "100%",
                      background: "#081017",
                      border: "1px solid #162634",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#f0f4f8",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div style={{ width: "160px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Role
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#081017",
                      border: "1px solid #162634",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#f0f4f8",
                      fontSize: "13px",
                    }}
                  >
                    <option value="commissioner">Commissioner</option>
                    <option value="referee">Referee</option>
                    <option value="timekeeper">Timekeeper</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isStaffPending || !staffEmail.trim()}
                  className="button primary"
                  style={{ fontWeight: 800, padding: "8px 18px", fontSize: "13px" }}
                >
                  {isStaffPending ? "Saving..." : "+ Assign Staff"}
                </button>
              </form>

              {staffMsg && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12.5px",
                    background: staffMsg.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: staffMsg.type === "success" ? "#6ee7b7" : "#fca5a5",
                  }}
                >
                  {staffMsg.text}
                </div>
              )}
            </div>

            {/* Current Staff List */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px" }}>Current Staff &amp; Officials ({staff.length})</h3>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Active governance permissions</span>
                </div>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th style={{ width: "100px", textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={`${s.user_id}-${s.role}`}>
                      <td><strong>{s.email}</strong></td>
                      <td><span className="badge" style={{ fontSize: "11px" }}>{s.role.toUpperCase()}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(s.user_id, s.role)}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", color: "#f87171", padding: "2px 8px" }}
                          disabled={isStaffPending}
                          title="Remove staff role"
                        >
                          Remove
                        </button>
                      </td>
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
              <form onSubmit={handleSaveDomain} style={{ display: "flex", gap: "10px", alignItems: "center", maxWidth: "600px" }}>
                <input
                  type="text"
                  required
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
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
                <button
                  type="submit"
                  disabled={isDomainPending || !domainInput.trim()}
                  className="button primary"
                  style={{ fontWeight: 800 }}
                >
                  {isDomainPending ? "Saving..." : "Save Custom Domain"}
                </button>
              </form>

              {domainMsg && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12.5px",
                    background: domainMsg.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: domainMsg.type === "success" ? "#6ee7b7" : "#fca5a5",
                    maxWidth: "600px",
                  }}
                >
                  {domainMsg.text}
                </div>
              )}
            </div>

            {settings ? (
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "17px" }}>Season Rules &amp; Competition Format</h3>
                <SeasonSettingsForm
                  settings={settings}
                  seasonId={settings.season_id || seasons[0]?.id || ""}
                  canManage={true}
                />
              </div>
            ) : (
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "17px" }}>Season Rules &amp; Competition Format</h3>
                <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
                  No season settings configured yet for this league. Initialize rules using the Season Settings form.
                </p>
                {seasons.length > 0 && (
                  <SeasonSettingsForm
                    settings={null}
                    seasonId={seasons[0].id}
                    canManage={true}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
