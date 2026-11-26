"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ScheduleImporter } from "@/components/schedule-importer";
import { SeasonSettingsForm } from "@/components/season-settings-form";
import {
  addStaffMemberAction,
  removeStaffMemberAction,
  saveLeagueDomainAction,
  createSeasonAction,
  createDivisionAction,
  createTeamAction,
  updateTeamAction,
  saveLeagueBrandingAction,
  createGameAction,
} from "@/app/(portal)/admin/league/[leagueId]/admin-actions";

export interface LeagueAdminData {
  league: {
    id: string;
    name: string;
    season?: string;
    teams?: number;
  };
  allLeagues?: { id: string; name: string }[];
  seasons: { id: string; name: string }[];
  divisions: { id: string; name: string; season_name: string; season_id: string }[];
  teams: { id: string; entry_id: string; name: string; division_name: string; season_name: string }[];
  rosterPlayers?: {
    id: string;
    playerId: string;
    playerName: string;
    teamEntryId: string;
    teamName: string;
    jerseyNumber?: number | null;
    position: string;
    status: string;
  }[];
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

const BRAND_COLOR_PRESETS = [
  { name: "Neon Lime (Default)", hex: "#c7f450" },
  { name: "theScore Blue", hex: "#3b82f6" },
  { name: "Crimson Red", hex: "#ef4444" },
  { name: "Ice Cyan", hex: "#06b6d4" },
  { name: "Emerald Gold", hex: "#10b981" },
  { name: "Vibrant Orange", hex: "#f97316" },
  { name: "Deep Purple", hex: "#8b5cf6" },
];

export function LeagueAdminShell({ data, initialTab = "overview", children }: LeagueAdminShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || initialTab;

  const {
    league,
    allLeagues = [],
    seasons,
    divisions,
    teams,
    rosterPlayers = [],
    games,
    venues,
    rinks,
    staff,
    registrations,
    rosterCount,
    overridesCount,
    settings,
  } = data;

  // Filter state for Teams tab
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState("all");

  // Modals state
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDivisionId, setNewTeamDivisionId] = useState(divisions[0]?.id || "");
  const [teamActionPending, setTeamActionPending] = useState(false);
  const [teamActionMsg, setTeamActionMsg] = useState<string | null>(null);

  const [editTeamModal, setEditTeamModal] = useState<{
    entryId: string;
    teamId: string;
    name: string;
    divisionId: string;
  } | null>(null);

  const [showAddSeasonModal, setShowAddSeasonModal] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [seasonActionPending, setSeasonActionPending] = useState(false);
  const [seasonActionMsg, setSeasonActionMsg] = useState<string | null>(null);

  const [showAddDivisionModal, setShowAddDivisionModal] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionSeasonId, setNewDivisionSeasonId] = useState(seasons[0]?.id || "");
  const [divisionActionPending, setDivisionActionPending] = useState(false);
  const [divisionActionMsg, setDivisionActionMsg] = useState<string | null>(null);

  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [gameHomeEntry, setGameHomeEntry] = useState(teams[0]?.entry_id || "");
  const [gameAwayEntry, setGameAwayEntry] = useState(teams[1]?.entry_id || teams[0]?.entry_id || "");
  const [gameStartsAt, setGameStartsAt] = useState("");
  const [gameRinkId, setGameRinkId] = useState(rinks[0]?.id || "");
  const [gameActionPending, setGameActionPending] = useState(false);
  const [gameActionMsg, setGameActionMsg] = useState<string | null>(null);

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

  // Branding color state
  const initialColor = settings?.currency?.startsWith("#") ? settings.currency : "#c7f450";
  const [primaryColor, setPrimaryColor] = useState(initialColor);
  const [isBrandingPending, setIsBrandingPending] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState<string | null>(null);

  const entriesForSchedule = teams.map((t) => ({
    id: t.entry_id,
    team_id: t.id,
    division_id: divisions.find((d) => d.name === t.division_name)?.id || "",
    label: `${t.name} (${t.division_name})`,
  }));

  const navItems = [
    { key: "overview", label: "HQ Overview", icon: "📊" },
    { key: "seasons", label: "Seasons & Divisions", icon: "🏆", badge: seasons.length },
    { key: "teams", label: "Teams", icon: "🏒", badge: teams.length },
    { key: "rosters", label: "Rosters", icon: "👥", badge: rosterPlayers.length || rosterCount },
    { key: "schedule", label: "Schedule", icon: "📅", badge: games.length },
    { key: "gamecentre", label: "Game Centre & Scores", icon: "⏱️" },
    { key: "registrations", label: "Registrations & Waivers", icon: "📝", badge: registrations.length },
    { key: "governance", label: "Staff & Governance", icon: "🛡️", badge: staff.length },
    { key: "settings", label: "Settings", icon: "⚙️" },
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

  const handleSaveBranding = async (colorHex: string) => {
    setPrimaryColor(colorHex);
    setIsBrandingPending(true);
    setBrandingMsg(null);
    const res = await saveLeagueBrandingAction({ leagueId: league.id, primaryColor: colorHex });
    setIsBrandingPending(false);
    setBrandingMsg(res.message);
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;
    setSeasonActionPending(true);
    setSeasonActionMsg(null);
    const res = await createSeasonAction({ leagueId: league.id, name: newSeasonName.trim() });
    setSeasonActionPending(false);
    if (res.success) {
      setNewSeasonName("");
      setShowAddSeasonModal(false);
      router.refresh();
    } else {
      setSeasonActionMsg(res.message);
    }
  };

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivisionName.trim() || !newDivisionSeasonId) return;
    setDivisionActionPending(true);
    setDivisionActionMsg(null);
    const res = await createDivisionAction({
      leagueId: league.id,
      seasonId: newDivisionSeasonId,
      name: newDivisionName.trim(),
    });
    setDivisionActionPending(false);
    if (res.success) {
      setNewDivisionName("");
      setShowAddDivisionModal(false);
      router.refresh();
    } else {
      setDivisionActionMsg(res.message);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamDivisionId) return;
    setTeamActionPending(true);
    setTeamActionMsg(null);
    const res = await createTeamAction({
      leagueId: league.id,
      divisionId: newTeamDivisionId,
      name: newTeamName.trim(),
    });
    setTeamActionPending(false);
    if (res.success) {
      setNewTeamName("");
      setShowAddTeamModal(false);
      router.refresh();
    } else {
      setTeamActionMsg(res.message);
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeamModal || !editTeamModal.name.trim()) return;
    setTeamActionPending(true);
    setTeamActionMsg(null);
    const res = await updateTeamAction({
      leagueId: league.id,
      entryId: editTeamModal.entryId,
      teamId: editTeamModal.teamId,
      name: editTeamModal.name.trim(),
      divisionId: editTeamModal.divisionId,
    });
    setTeamActionPending(false);
    if (res.success) {
      setEditTeamModal(null);
      router.refresh();
    } else {
      setTeamActionMsg(res.message);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameHomeEntry || !gameAwayEntry || !gameStartsAt) return;
    setGameActionPending(true);
    setGameActionMsg(null);
    const res = await createGameAction({
      leagueId: league.id,
      homeEntryId: gameHomeEntry,
      awayEntryId: gameAwayEntry,
      startsAt: new Date(gameStartsAt).toISOString(),
      rinkId: gameRinkId,
    });
    setGameActionPending(false);
    if (res.success) {
      setShowAddGameModal(false);
      router.refresh();
    } else {
      setGameActionMsg(res.message);
    }
  };

  const filteredTeams = selectedDivisionFilter === "all"
    ? teams
    : teams.filter((t) => t.division_name === selectedDivisionFilter);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "250px 1fr",
        minHeight: "100vh",
        background: "#060d13",
        color: "#f0f4f8",
      }}
    >
      {/* 1. Sticky Left Sidebar with League Dropdown Switcher */}
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
          padding: "18px 14px",
          zIndex: 40,
        }}
      >
        <div>
          {/* League Dropdown Switcher per Video 1 */}
          <div
            style={{
              paddingBottom: "14px",
              borderBottom: "1px solid #162634",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: primaryColor,
                  color: "#081017",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                {league.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: "11px", fontWeight: 800, color: primaryColor, letterSpacing: "1px", textTransform: "uppercase" }}>
                LEAGUE BACKEND
              </span>
            </div>

            {/* Interactive League Selector Dropdown */}
            <select
              value={league.id}
              onChange={(e) => router.push(`/admin/league/${e.target.value}`)}
              style={{
                width: "100%",
                background: "#0d1b26",
                color: "#f0f4f8",
                border: "1px solid #1e3347",
                borderRadius: "8px",
                padding: "6px 8px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
              }}
              title="Switch League"
            >
              {allLeagues.length > 0 ? (
                allLeagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              ) : (
                <option value={league.id}>{league.name}</option>
              )}
            </select>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
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
                    padding: "8px 10px",
                    borderRadius: "7px",
                    fontSize: "12.5px",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? "#081017" : "#cbd5e1",
                    background: isActive ? primaryColor : "transparent",
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: "9.5px",
                        padding: "1px 5px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        background: isActive ? "#081017" : "rgba(255,255,255,0.1)",
                        color: isActive ? primaryColor : "var(--muted)",
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
        <div style={{ borderTop: "1px solid #162634", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <a
            href={`/api/switch-league?league=${league.id}&redirect=%2F`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <span>🌐</span>
            <span>Public League Site ↗</span>
          </a>

          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <span>⚙️</span>
            <span>Admin Console</span>
          </Link>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main style={{ padding: "24px 32px", maxWidth: "1380px" }}>
        {/* Top Header - Cleaned up per Video 1 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#f0f4f8" }}>
              {navItems.find((n) => n.key === activeTab)?.label ?? "HQ Overview"}
            </h2>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {league.name} · Management Hub
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Link
              href={`/api/switch-league?league=${league.id}&redirect=%2Fschedule`}
              target="_blank"
              className="button button-sm button-outline"
              style={{ fontSize: "12px", padding: "6px 14px" }}
            >
              Public Schedule ↗
            </Link>
          </div>
        </div>

        {/* Tab 1: HQ Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Registered Teams</span>
                <div style={{ fontSize: "26px", fontWeight: 900, color: primaryColor, marginTop: "4px" }}>
                  {teams.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Across {divisions.length} divisions</span>
              </div>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Roster Athletes</span>
                <div style={{ fontSize: "26px", fontWeight: 900, color: "#f0f4f8", marginTop: "4px" }}>
                  {rosterPlayers.length || rosterCount}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Active team members</span>
              </div>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Scheduled Matches</span>
                <div style={{ fontSize: "26px", fontWeight: 900, color: "#60a5fa", marginTop: "4px" }}>
                  {games.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>In league schedule</span>
              </div>
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "16px" }}>
                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Governance Staff</span>
                <div style={{ fontSize: "26px", fontWeight: 900, color: "#34d399", marginTop: "4px" }}>
                  {staff.length}
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Referees &amp; timekeepers</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "15px", color: "#f0f4f8" }}>
                Commissioner Navigation Shortcuts
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setTab("schedule")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "10px 14px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: primaryColor, fontSize: "13px" }}>📅 Match Schedule</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Add fixtures &amp; bulk import</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("teams")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "10px 14px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: primaryColor, fontSize: "13px" }}>🏒 Teams Directory</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Add &amp; manage club entries</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("rosters")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "10px 14px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: primaryColor, fontSize: "13px" }}>👥 Player Rosters</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Clearance statuses &amp; waivers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  className="button button-outline"
                  style={{ textAlign: "left", padding: "10px 14px", height: "auto" }}
                >
                  <strong style={{ display: "block", color: primaryColor, fontSize: "13px" }}>⚙️ Branding &amp; Rules</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>Color palette &amp; tiebreakers</span>
                </button>
              </div>
            </div>

            {/* Upcoming Games Quick View */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#f0f4f8" }}>
                  Upcoming Matches ({games.length})
                </span>
                <button type="button" onClick={() => setTab("schedule")} style={{ background: "none", border: "none", color: primaryColor, cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  Schedule View →
                </button>
              </div>
              {games.length > 0 ? (
                <table className="table" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "140px" }}>TIME</th>
                      <th>MATCHUP</th>
                      <th>RINK / VENUE</th>
                      <th style={{ width: "100px", textAlign: "right" }}>STATUS</th>
                      <th style={{ width: "120px", textAlign: "right" }}>SCOREKEEPER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.slice(0, 5).map((g) => (
                      <tr key={g.id}>
                        <td>{new Date(g.starts_at).toLocaleDateString()} {new Date(g.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td><strong>{g.away_name}</strong> @ <strong>{g.home_name}</strong></td>
                        <td style={{ color: "var(--muted)" }}>{g.rink_name}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className="badge" style={{ fontSize: "9.5px" }}>{g.status.toUpperCase()}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/schedule/${g.id}/scorekeeping`} className="button button-sm button-outline" style={{ fontSize: "11px", padding: "3px 8px" }}>
                            ⏱️ Game Centre
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "28px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                  No games scheduled yet. Go to Schedule to add or import fixtures.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Seasons & Divisions (Clean Directory & Modal Popups per Video 1) */}
        {activeTab === "seasons" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15.5px" }}>Competition Seasons &amp; Divisions</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Configure your league hierarchy. Add teams under the Teams tab.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddSeasonModal(true)}
                  className="button button-sm primary"
                  style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                >
                  + Add Season
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDivisionModal(true)}
                  className="button button-sm button-outline"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                  disabled={seasons.length === 0}
                >
                  + Add Division
                </button>
              </div>
            </div>

            {/* Grid directory of divisions */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634" }}>
                <h4 style={{ margin: 0, fontSize: "13.5px" }}>Configured Divisions ({divisions.length})</h4>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>DIVISION</th>
                    <th>SEASON</th>
                    <th>REGISTERED TEAMS</th>
                    <th style={{ textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map((div) => {
                    const divTeams = teams.filter((t) => t.division_name === div.name);
                    return (
                      <tr key={div.id}>
                        <td><strong style={{ color: primaryColor }}>{div.name}</strong></td>
                        <td style={{ color: "var(--muted)" }}>{div.season_name}</td>
                        <td>{divTeams.length} teams</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDivisionFilter(div.name);
                              setTab("teams");
                            }}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "2px 8px" }}
                          >
                            View Teams →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {divisions.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                        No divisions created yet. Click "+ Add Division" above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Teams (Directory with Dropdown Filter & Edit Modal per Video 1) */}
        {activeTab === "teams" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Filter Bar & Add Team */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0c1822",
                padding: "14px 18px",
                borderRadius: "12px",
                border: "1px solid #162634",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700 }}>
                  Division Filter:
                </label>
                <select
                  value={selectedDivisionFilter}
                  onChange={(e) => setSelectedDivisionFilter(e.target.value)}
                  style={{
                    background: "#081017",
                    color: "#f0f4f8",
                    border: "1px solid #162634",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  <option value="all">All Divisions ({teams.length} teams)</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({teams.filter((t) => t.division_name === d.name).length})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowAddTeamModal(true)}
                className="button button-sm primary"
                style={{ fontSize: "12px", padding: "6px 16px", fontWeight: 700 }}
              >
                + Add Team
              </button>
            </div>

            {/* Teams Directory Table */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14.5px", color: "#f0f4f8" }}>
                    League Teams Directory ({filteredTeams.length})
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                    Click any team name to edit details. Click "Manage Roster" for players.
                  </span>
                </div>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>TEAM NAME</th>
                    <th>DIVISION</th>
                    <th>SEASON</th>
                    <th style={{ width: "220px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            const curDiv = divisions.find((d) => d.name === t.division_name);
                            setEditTeamModal({
                              entryId: t.entry_id,
                              teamId: t.id,
                              name: t.name,
                              divisionId: curDiv?.id || "",
                            });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: primaryColor,
                            fontWeight: 800,
                            fontSize: "13px",
                            cursor: "pointer",
                            textAlign: "left",
                            textDecoration: "underline",
                            textUnderlineOffset: "3px",
                          }}
                          title="Click to edit team"
                        >
                          {t.name}
                        </button>
                      </td>
                      <td><span className="badge" style={{ fontSize: "10.5px" }}>{t.division_name}</span></td>
                      <td style={{ color: "var(--muted)" }}>{t.season_name}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <Link href={`/teams/${t.entry_id}`} className="button button-sm button-outline" style={{ fontSize: "11px", padding: "3px 8px" }}>
                            👥 Manage Roster
                          </Link>
                          <a
                            href={`/teams/join?team=${t.entry_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                            title="Player invite link"
                          >
                            🔗 Invite
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTeams.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No teams registered in this division yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Rosters (Dedicated Roster Players Directory per Video 1 & 2) */}
        {activeTab === "rosters" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "14px 18px", borderRadius: "12px", border: "1px solid #162634" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px" }}>Player Rosters &amp; Clearance Pipeline</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Track who is invited, waiver status, and clearance to play across all teams.
                </p>
              </div>
              <span className="badge" style={{ fontSize: "11px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                {rosterPlayers.length} Active Rostered Players
              </span>
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>PLAYER NAME</th>
                    <th>TEAM</th>
                    <th>JERSEY #</th>
                    <th>POSITION</th>
                    <th>CLEARANCE STATUS</th>
                    <th style={{ textAlign: "right" }}>ROSTER LINK</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterPlayers.map((p) => {
                    const isCleared = p.status === "active";
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link
                            href={`/players/${p.playerId}`}
                            style={{ color: "#f0f4f8", fontWeight: 700, textDecoration: "none" }}
                          >
                            {p.playerName}
                          </Link>
                        </td>
                        <td><span className="badge" style={{ fontSize: "10px" }}>{p.teamName}</span></td>
                        <td>{p.jerseyNumber ? `#${p.jerseyNumber}` : "-"}</td>
                        <td>{p.position}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              fontSize: "10px",
                              background: isCleared ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.18)",
                              color: isCleared ? "#10b981" : "#f59e0b",
                            }}
                          >
                            {isCleared ? "🟢 Cleared to Play" : "🟠 Waiver Needed"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link href={`/teams/${p.teamEntryId}`} className="button button-sm button-outline" style={{ fontSize: "11px", padding: "2px 8px" }}>
                            Team Page →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {rosterPlayers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No players registered on team rosters yet. Use team invite links or the captain portal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Schedule (Renamed per Video 2, with Bulk Importer & Direct Game Centre) */}
        {activeTab === "schedule" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15.5px" }}>Match Schedule Management</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Add fixtures or upload CSV schedules. Expected format: <code>Date, Time, Home Team, Away Team, Arena, Rink</code>.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddGameModal(true)}
                  className="button button-sm primary"
                  style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                  disabled={teams.length < 2}
                >
                  + Add Match
                </button>
                <ScheduleImporter
                  leagueId={league.id}
                  entries={entriesForSchedule}
                  venues={venues}
                  rinks={rinks}
                />
              </div>
            </div>

            {/* Scheduled Matches Table */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634" }}>
                <h4 style={{ margin: 0, fontSize: "13.5px" }}>Scheduled Fixtures ({games.length})</h4>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "140px" }}>DATE &amp; TIME</th>
                    <th>HOME TEAM</th>
                    <th>AWAY TEAM</th>
                    <th>ARENA / RINK</th>
                    <th style={{ width: "100px", textAlign: "right" }}>STATUS</th>
                    <th style={{ width: "130px", textAlign: "right" }}>TIMEKEEPER</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.id}>
                      <td>{new Date(g.starts_at).toLocaleDateString()} · {new Date(g.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td><strong>{g.home_name}</strong></td>
                      <td><strong>{g.away_name}</strong></td>
                      <td style={{ color: "var(--muted)" }}>{g.rink_name}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="badge" style={{ fontSize: "9.5px" }}>{g.status.toUpperCase()}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/schedule/${g.id}/scorekeeping`} className="button button-sm button-outline" style={{ fontSize: "11px", padding: "3px 8px" }}>
                          ⏱️ Game Centre
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {games.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No fixtures scheduled. Click "+ Add Match" or use the Bulk Importer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Game Centre (Direct Timekeeping & Scores) */}
        {activeTab === "gamecentre" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "15.5px" }}>Official Rink Game Centre</h3>
              <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--muted)" }}>
                Launch the timekeeper and scorekeeper console for live scoring, penalties, and three stars of the game.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                {games.map((g) => (
                  <div key={g.id} style={{ background: "#081017", border: "1px solid #162634", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                      <span>{g.rink_name}</span>
                      <span className="badge" style={{ fontSize: "9px" }}>{g.status.toUpperCase()}</span>
                    </div>
                    <h4 style={{ margin: "8px 0", fontSize: "14.5px" }}>{g.away_name} vs {g.home_name}</h4>
                    <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "10px" }}>
                      {new Date(g.starts_at).toLocaleDateString()} @ {new Date(g.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Link
                      href={`/schedule/${g.id}/scorekeeping`}
                      className="button button-sm primary"
                      style={{ width: "100%", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}
                    >
                      ⏱️ Launch Game Centre Console
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Registrations & Waivers */}
        {activeTab === "registrations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "15.5px" }}>Registrations &amp; Digital Waivers</h3>
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
                Live database clearance records from player sign-ups and GoHighLevel waivers.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div style={{ background: "#081017", padding: "14px", borderRadius: "8px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Rostered Players</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "2px", color: primaryColor }}>{rosterPlayers.length || rosterCount}</div>
                </div>
                <div style={{ background: "#081017", padding: "14px", borderRadius: "8px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11px", color: "#34d399" }}>🟢 Cleared to Play</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "2px", color: "#34d399" }}>
                    {overridesCount + registrations.filter(r => r.status === 'approved').length}
                  </div>
                </div>
                <div style={{ background: "#081017", padding: "14px", borderRadius: "8px", border: "1px solid #162634" }}>
                  <span style={{ fontSize: "11px", color: "#fb923c" }}>🟠 Waiver Needed</span>
                  <div style={{ fontSize: "24px", fontWeight: 900, marginTop: "2px", color: "#fb923c" }}>
                    {registrations.filter(r => r.status === 'pending').length}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
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
                        <span className="badge" style={{ fontSize: "10px" }}>{r.status.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                  {registrations.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                        No player registrations recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 8: Staff & Governance */}
        {activeTab === "governance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "18px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>Assign Staff &amp; Officials</h3>
              <form onSubmit={handleAddStaff} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "12px" }}>
                <div style={{ flex: 1, minWidth: "220px" }}>
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
                      borderRadius: "6px",
                      padding: "7px 10px",
                      color: "#f0f4f8",
                      fontSize: "12.5px",
                    }}
                  />
                </div>
                <div style={{ width: "150px" }}>
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
                      borderRadius: "6px",
                      padding: "7px 10px",
                      color: "#f0f4f8",
                      fontSize: "12.5px",
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
                  style={{ fontWeight: 800, padding: "7px 16px", fontSize: "12.5px" }}
                >
                  {isStaffPending ? "Saving..." : "+ Assign Staff"}
                </button>
              </form>
              {staffMsg && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: staffMsg.type === "success" ? "#6ee7b7" : "#fca5a5" }}>
                  {staffMsg.text}
                </div>
              )}
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>EMAIL</th>
                    <th>ROLE</th>
                    <th style={{ width: "90px", textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={`${s.user_id}-${s.role}`}>
                      <td><strong>{s.email}</strong></td>
                      <td><span className="badge" style={{ fontSize: "10px" }}>{s.role.toUpperCase()}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(s.user_id, s.role)}
                          className="button button-sm button-outline"
                          style={{ fontSize: "10.5px", color: "#f87171", padding: "2px 6px" }}
                          disabled={isStaffPending}
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

        {/* Tab 9: Settings & Branding (Color Palette per Video 2) */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Branded Color Palette Picker */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "15.5px" }}>Public Site Branding &amp; Color Scheme</h3>
              <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--muted)" }}>
                Select a branded color palette for {league.name}. This color accents the public portal header, score badges, and primary buttons.
              </p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "16px" }}>
                {BRAND_COLOR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => handleSaveBranding(p.hex)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      background: primaryColor === p.hex ? "rgba(255,255,255,0.12)" : "#081017",
                      border: primaryColor === p.hex ? `2px solid ${p.hex}` : "1px solid #162634",
                      color: "#f0f4f8",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: p.hex,
                        display: "inline-block",
                      }}
                    />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              {brandingMsg && (
                <div style={{ fontSize: "12px", color: "var(--lime)", marginTop: "8px" }}>
                  {brandingMsg}
                </div>
              )}
            </div>

            {/* Custom Domain */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "15.5px" }}>Custom Domain Configuration</h3>
              <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--muted)" }}>
                Point CNAME to <code>plaionn.brittosoft.online</code> to connect a branded domain.
              </p>
              <form onSubmit={handleSaveDomain} style={{ display: "flex", gap: "10px", maxWidth: "560px" }}>
                <input
                  type="text"
                  required
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#081017",
                    border: "1px solid #162634",
                    borderRadius: "6px",
                    padding: "7px 10px",
                    color: "#f0f4f8",
                    fontSize: "13px",
                  }}
                />
                <button type="submit" disabled={isDomainPending} className="button primary" style={{ fontWeight: 800, fontSize: "12.5px" }}>
                  {isDomainPending ? "Saving..." : "Save Domain"}
                </button>
              </form>
              {domainMsg && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: domainMsg.type === "success" ? "#6ee7b7" : "#fca5a5" }}>
                  {domainMsg.text}
                </div>
              )}
            </div>

            {/* Season Rules */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "15.5px" }}>Overtime, Tiebreaker &amp; Point Rules</h3>
              {seasons.length > 0 && (
                <SeasonSettingsForm
                  settings={settings}
                  seasonId={settings?.season_id || seasons[0].id}
                  canManage={true}
                />
              )}
            </div>
          </div>
        )}

        {/* Modal: Add Team */}
        {showAddTeamModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", maxWidth: "440px", width: "100%" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>+ Add Team to League</h3>
              <form onSubmit={handleCreateTeam} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. Northline HC"
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Division
                  </label>
                  <select
                    value={newTeamDivisionId}
                    onChange={(e) => setNewTeamDivisionId(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.season_name} · {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                {teamActionMsg && <div style={{ fontSize: "12px", color: "#f87171" }}>{teamActionMsg}</div>}
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button type="button" onClick={() => setShowAddTeamModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={teamActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 800 }}>
                    {teamActionPending ? "Saving..." : "Add Team"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Team */}
        {editTeamModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", maxWidth: "440px", width: "100%" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>Edit Team Details</h3>
              <form onSubmit={handleUpdateTeam} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editTeamModal.name}
                    onChange={(e) => setEditTeamModal({ ...editTeamModal, name: e.target.value })}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Division
                  </label>
                  <select
                    value={editTeamModal.divisionId}
                    onChange={(e) => setEditTeamModal({ ...editTeamModal, divisionId: e.target.value })}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.season_name} · {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                {teamActionMsg && <div style={{ fontSize: "12px", color: "#f87171" }}>{teamActionMsg}</div>}
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button type="button" onClick={() => setEditTeamModal(null)} className="button button-outline" style={{ fontSize: "12px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={teamActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 800 }}>
                    {teamActionPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Season */}
        {showAddSeasonModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", maxWidth: "420px", width: "100%" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>+ Start New Season</h3>
              <form onSubmit={handleCreateSeason} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Season Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder="e.g. Winter 2027"
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  />
                </div>
                {seasonActionMsg && <div style={{ fontSize: "12px", color: "#f87171" }}>{seasonActionMsg}</div>}
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button type="button" onClick={() => setShowAddSeasonModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={seasonActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 800 }}>
                    {seasonActionPending ? "Saving..." : "Create Season"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Division */}
        {showAddDivisionModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", maxWidth: "420px", width: "100%" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>+ Add Competition Division</h3>
              <form onSubmit={handleCreateDivision} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Parent Season
                  </label>
                  <select
                    value={newDivisionSeasonId}
                    onChange={(e) => setNewDivisionSeasonId(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Division Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDivisionName}
                    onChange={(e) => setNewDivisionName(e.target.value)}
                    placeholder="e.g. Tuesday Over 40"
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  />
                </div>
                {divisionActionMsg && <div style={{ fontSize: "12px", color: "#f87171" }}>{divisionActionMsg}</div>}
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button type="button" onClick={() => setShowAddDivisionModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={divisionActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 800 }}>
                    {divisionActionPending ? "Saving..." : "Create Division"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Game Fixture */}
        {showAddGameModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "12px", padding: "24px", maxWidth: "480px", width: "100%" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "16px" }}>+ Schedule Match Fixture</h3>
              <form onSubmit={handleCreateGame} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Home Team
                  </label>
                  <select
                    value={gameHomeEntry}
                    onChange={(e) => setGameHomeEntry(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {teams.map((t) => (
                      <option key={t.entry_id} value={t.entry_id}>
                        {t.name} ({t.division_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Away Team
                  </label>
                  <select
                    value={gameAwayEntry}
                    onChange={(e) => setGameAwayEntry(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {teams.map((t) => (
                      <option key={t.entry_id} value={t.entry_id}>
                        {t.name} ({t.division_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Start Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={gameStartsAt}
                    onChange={(e) => setGameStartsAt(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    Arena / Rink
                  </label>
                  <select
                    value={gameRinkId}
                    onChange={(e) => setGameRinkId(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #162634", borderRadius: "6px", padding: "8px 10px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {rinks.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {gameActionMsg && <div style={{ fontSize: "12px", color: "#f87171" }}>{gameActionMsg}</div>}

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button type="button" onClick={() => setShowAddGameModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={gameActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 800 }}>
                    {gameActionPending ? "Saving..." : "Schedule Match"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
