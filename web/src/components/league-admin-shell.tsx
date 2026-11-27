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
  updateSeasonAction,
  createDivisionAction,
  updateDivisionAction,
  createTeamAction,
  updateTeamAction,
  createRosterPlayerAction,
  updateGameStatusAction,
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
  { name: "Wave Blue", hex: "#0284c7" },
  { name: "theScore Blue", hex: "#3b82f6" },
  { name: "Vibrant Orange", hex: "#ea580c" },
  { name: "Crimson Red", hex: "#ef4444" },
  { name: "Ice Cyan", hex: "#06b6d4" },
  { name: "Emerald Gold", hex: "#10b981" },
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

  // Filter states
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>("all");
  const [rosterSeasonFilter, setRosterSeasonFilter] = useState<string>("all");
  const [rosterDivisionFilter, setRosterDivisionFilter] = useState<string>("all");
  const [rosterTeamFilter, setRosterTeamFilter] = useState<string>("all");
  const [rosterStatusFilter, setRosterStatusFilter] = useState<string>("all");

  const [scheduleSeasonFilter, setScheduleSeasonFilter] = useState<string>("all");
  const [scheduleDivisionFilter, setScheduleDivisionFilter] = useState<string>("all");
  const [scheduleTeamFilter, setScheduleTeamFilter] = useState<string>("all");

  // Modal states
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

  const [editingSeason, setEditingSeason] = useState<{ id: string; name: string } | null>(null);
  const [editingDivision, setEditingDivision] = useState<{ id: string; name: string; season_id: string } | null>(null);

  const [showAddDivisionModal, setShowAddDivisionModal] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionSeasonId, setNewDivisionSeasonId] = useState(seasons[0]?.id || "");
  const [divisionActionPending, setDivisionActionPending] = useState(false);
  const [divisionActionMsg, setDivisionActionMsg] = useState<string | null>(null);

  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerTeamEntryId, setNewPlayerTeamEntryId] = useState(teams[0]?.entry_id || "");
  const [newPlayerJersey, setNewPlayerJersey] = useState<string>("");
  const [newPlayerPosition, setNewPlayerPosition] = useState<string>("F");
  const [newPlayerStatus, setNewPlayerStatus] = useState<string>("active");
  const [playerActionPending, setPlayerActionPending] = useState(false);
  const [playerActionMsg, setPlayerActionMsg] = useState<string | null>(null);

  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [gameHomeEntry, setGameHomeEntry] = useState(teams[0]?.entry_id || "");
  const [gameAwayEntry, setGameAwayEntry] = useState(teams[1]?.entry_id || teams[0]?.entry_id || "");
  const [gameStartsAt, setGameStartsAt] = useState("");
  const [gameRinkId, setGameRinkId] = useState(rinks[0]?.id || "");
  const [gameActionPending, setGameActionPending] = useState(false);
  const [gameActionMsg, setGameActionMsg] = useState<string | null>(null);

  // Embedded Game Centre Console State
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || "");
  const [gameStatusPending, setGameStatusPending] = useState(false);
  const [gameStatusMsg, setGameStatusMsg] = useState<string | null>(null);

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

  const mainNavTabs = [
    { key: "overview", label: "Overview", icon: "📊" },
    { key: "seasons", label: "Seasons & Divisions", icon: "🏆", badge: seasons.length },
    { key: "teams", label: "Teams", icon: "🏒", badge: teams.length },
    { key: "rosters", label: "Rosters", icon: "👥", badge: rosterPlayers.length || rosterCount },
    { key: "schedule", label: "Schedule", icon: "📅", badge: games.length },
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

  const handleUpdateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeason || !editingSeason.name.trim()) return;
    setSeasonActionPending(true);
    setSeasonActionMsg(null);
    const res = await updateSeasonAction({
      leagueId: league.id,
      seasonId: editingSeason.id,
      name: editingSeason.name.trim(),
    });
    setSeasonActionPending(false);
    if (res.success) {
      setEditingSeason(null);
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

  const handleUpdateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDivision || !editingDivision.name.trim()) return;
    setDivisionActionPending(true);
    setDivisionActionMsg(null);
    const res = await updateDivisionAction({
      leagueId: league.id,
      divisionId: editingDivision.id,
      seasonId: editingDivision.season_id,
      name: editingDivision.name.trim(),
    });
    setDivisionActionPending(false);
    if (res.success) {
      setEditingDivision(null);
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

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !newPlayerTeamEntryId) return;
    setPlayerActionPending(true);
    setPlayerActionMsg(null);
    const res = await createRosterPlayerAction({
      leagueId: league.id,
      teamEntryId: newPlayerTeamEntryId,
      playerName: newPlayerName.trim(),
      jerseyNumber: newPlayerJersey ? parseInt(newPlayerJersey, 10) : undefined,
      position: newPlayerPosition,
      status: newPlayerStatus,
    });
    setPlayerActionPending(false);
    if (res.success) {
      setNewPlayerName("");
      setNewPlayerJersey("");
      setShowAddPlayerModal(false);
      router.refresh();
    } else {
      setPlayerActionMsg(res.message);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameHomeEntry || !gameAwayEntry || !gameStartsAt) return;
    if (gameHomeEntry === gameAwayEntry) {
      setGameActionMsg("Home and away teams must be different.");
      return;
    }
    setGameActionPending(true);
    setGameActionMsg(null);
    const res = await createGameAction({
      leagueId: league.id,
      homeEntryId: gameHomeEntry,
      awayEntryId: gameAwayEntry,
      startsAt: new Date(gameStartsAt).toISOString(),
      rinkId: gameRinkId || undefined,
    });
    setGameActionPending(false);
    if (res.success) {
      setShowAddGameModal(false);
      router.refresh();
    } else {
      setGameActionMsg(res.message);
    }
  };

  const handleUpdateGameStatus = async (gameId: string, status: "scheduled" | "in_progress" | "final") => {
    setGameStatusPending(true);
    setGameStatusMsg(null);
    const res = await updateGameStatusAction({ leagueId: league.id, gameId, status });
    setGameStatusPending(false);
    if (res.success) {
      setGameStatusMsg(`✓ Game status updated to ${status.toUpperCase()}`);
      router.refresh();
    } else {
      setGameStatusMsg(res.message);
    }
  };

  // Filtered lists
  const filteredTeams = selectedDivisionFilter === "all"
    ? teams
    : teams.filter((t) => t.division_name === selectedDivisionFilter);

  const filteredRoster = rosterPlayers.filter((p) => {
    const parentTeam = teams.find((t) => t.entry_id === p.teamEntryId);
    if (rosterSeasonFilter !== "all" && parentTeam?.season_name !== rosterSeasonFilter) return false;
    if (rosterDivisionFilter !== "all" && parentTeam?.division_name !== rosterDivisionFilter) return false;
    if (rosterTeamFilter !== "all" && p.teamEntryId !== rosterTeamFilter) return false;
    if (rosterStatusFilter === "cleared" && p.status !== "active") return false;
    if (rosterStatusFilter === "waiver" && p.status === "active") return false;
    return true;
  });

  const filteredGames = games.filter((g) => {
    const homeTeam = teams.find((t) => t.name === g.home_name);
    const awayTeam = teams.find((t) => t.name === g.away_name);
    if (scheduleSeasonFilter !== "all" && homeTeam?.season_name !== scheduleSeasonFilter && awayTeam?.season_name !== scheduleSeasonFilter) return false;
    if (scheduleDivisionFilter !== "all" && homeTeam?.division_name !== scheduleDivisionFilter && awayTeam?.division_name !== scheduleDivisionFilter) return false;
    if (scheduleTeamFilter !== "all" && homeTeam?.entry_id !== scheduleTeamFilter && awayTeam?.entry_id !== scheduleTeamFilter) return false;
    return true;
  });

  const activeSelectedGame = games.find((g) => g.id === selectedGameId) || games[0] || null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060d13",
        color: "#f0f4f8",
        width: "100%",
      }}
    >
      {/* Top Header Row with Left-Aligned Title + League Switcher & Top-Right Tools */}
      <header
        style={{
          background: "#081017",
          borderBottom: "1px solid #162634",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Left: League Crest + League Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/admin"
            title="Return to Central Leagues Console"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 700,
              padding: "6px 12px",
              background: "#101d27",
              border: "1px solid #1e3347",
              borderRadius: "6px",
              whiteSpace: "nowrap",
            }}
          >
            ← Leagues
          </Link>

          <div style={{ width: "1px", height: "24px", background: "#162634" }} />

          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: primaryColor,
              color: "#081017",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "15px",
              flexShrink: 0,
            }}
          >
            {league.name.charAt(0).toUpperCase()}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Interactive League Selector Dropdown */}
            <select
              value={league.id}
              onChange={(e) => router.push(`/admin/league/${e.target.value}`)}
              style={{
                background: "#0d1b26",
                color: "#ffffff",
                border: "1px solid #1e3347",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                outline: "none",
              }}
              title="Switch Active League"
            >
              {allLeagues.length > 0 ? (
                allLeagues.map((l) => (
                  <option key={l.id} value={l.id} style={{ background: "#081017", color: "#fff" }}>
                    {l.name}
                  </option>
                ))
              ) : (
                <option value={league.id} style={{ background: "#081017", color: "#fff" }}>{league.name}</option>
              )}
            </select>

            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: primaryColor,
                letterSpacing: "0.5px",
                background: "rgba(255, 255, 255, 0.06)",
                padding: "3px 8px",
                borderRadius: "4px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              COMMISSIONER HUB
            </span>
          </div>
        </div>

        {/* Right Tools: Public Schedule & Settings per Video 1 */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a
            href={`/api/switch-league?league=${league.id}&redirect=%2Fschedule`}
            target="_blank"
            rel="noreferrer"
            className="button button-sm button-outline"
            style={{ fontSize: "12px", padding: "7px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
            title="Open the front-end schedule for this league"
          >
            Public Schedule ↗
          </a>

          <button
            type="button"
            onClick={() => setTab("settings")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              background: activeTab === "settings" ? primaryColor : "#101d27",
              color: activeTab === "settings" ? "#081017" : "#f0f4f8",
              border: "1px solid #1e3347",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
            title="League Settings & Branding"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Tab Navigation Bar: Left-Aligned flush per Video 1 */}
      <nav
        style={{
          background: "#091219",
          borderBottom: "1px solid #162634",
          padding: "0 24px",
          display: "flex",
          gap: "4px",
          overflowX: "auto",
        }}
      >
        {mainNavTabs.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                border: "none",
                borderBottom: isActive ? `3px solid ${primaryColor}` : "3px solid transparent",
                background: "transparent",
                color: isActive ? "#ffffff" : "#94a3b8",
                fontSize: "13px",
                fontWeight: isActive ? 800 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    background: isActive ? primaryColor : "rgba(255,255,255,0.08)",
                    color: isActive ? "#081017" : "var(--muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area - Full width with clean padding */}
      <main style={{ padding: "24px 28px", maxWidth: "1440px", margin: "0 auto" }}>
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Quick Stats Grid */}
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
                <div style={{ fontSize: "26px", fontWeight: 900, color: "#38bdf8", marginTop: "4px" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setTab("schedule")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "14px 16px",
                    minHeight: "72px",
                    background: "#10202c",
                    border: "1px solid #1c3344",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    whiteSpace: "normal",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                >
                  <strong style={{ color: primaryColor, fontSize: "13.5px", fontWeight: 700 }}>📅 Match Schedule</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.3 }}>Add fixtures &amp; bulk import</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("teams")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "14px 16px",
                    minHeight: "72px",
                    background: "#10202c",
                    border: "1px solid #1c3344",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    whiteSpace: "normal",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                >
                  <strong style={{ color: primaryColor, fontSize: "13.5px", fontWeight: 700 }}>🏒 Teams Directory</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.3 }}>Add &amp; manage club entries</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("rosters")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "14px 16px",
                    minHeight: "72px",
                    background: "#10202c",
                    border: "1px solid #1c3344",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    whiteSpace: "normal",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                >
                  <strong style={{ color: primaryColor, fontSize: "13.5px", fontWeight: 700 }}>👥 Player Rosters</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.3 }}>Clearance statuses &amp; waivers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "14px 16px",
                    minHeight: "72px",
                    background: "#10202c",
                    border: "1px solid #1c3344",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    whiteSpace: "normal",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                >
                  <strong style={{ color: primaryColor, fontSize: "13.5px", fontWeight: 700 }}>⚙️ Branding &amp; Rules</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.3 }}>Color palette &amp; tiebreakers</span>
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

        {/* Tab 2: Seasons & Divisions (Clickable drill-downs per Video 1) */}
        {activeTab === "seasons" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15.5px" }}>Competition Seasons &amp; Divisions</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Click any season or division to edit. Add teams under the Teams tab.
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

            {/* Grid directory of divisions with click-to-edit drill-down */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634" }}>
                <h4 style={{ margin: 0, fontSize: "13.5px" }}>Configured Divisions ({divisions.length})</h4>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>DIVISION (CLICK TO EDIT)</th>
                    <th>PARENT SEASON</th>
                    <th>REGISTERED TEAMS</th>
                    <th style={{ textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map((div) => {
                    const divTeams = teams.filter((t) => t.division_name === div.name);
                    return (
                      <tr key={div.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setEditingDivision({ id: div.id, name: div.name, season_id: div.season_id })}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              color: primaryColor,
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                            title="Click to edit division"
                          >
                            {div.name} ✏️
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              const s = seasons.find((x) => x.id === div.season_id);
                              if (s) setEditingSeason({ id: s.id, name: s.name });
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              color: "var(--text)",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                            title="Click to edit season"
                          >
                            {div.season_name}
                          </button>
                        </td>
                        <td>
                          <span className="badge" style={{ fontSize: "10.5px" }}>
                            {divTeams.length} {divTeams.length === 1 ? "team" : "teams"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDivisionFilter(div.name);
                              setTab("teams");
                            }}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                          >
                            View Teams →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {divisions.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No divisions created yet. Click "+ Add Division" above to set up competition flights.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Seasons Directory Table */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634" }}>
                <h4 style={{ margin: 0, fontSize: "13.5px" }}>All Seasons ({seasons.length})</h4>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>SEASON NAME (CLICK TO EDIT)</th>
                    <th>DIVISIONS COUNT</th>
                    <th style={{ textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((s) => {
                    const sDivs = divisions.filter((d) => d.season_id === s.id);
                    return (
                      <tr key={s.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setEditingSeason({ id: s.id, name: s.name })}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              color: primaryColor,
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                            title="Click to rename season"
                          >
                            {s.name} ✏️
                          </button>
                        </td>
                        <td>
                          <span className="badge" style={{ fontSize: "10.5px" }}>
                            {sDivs.length} divisions
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => setEditingSeason({ id: s.id, name: s.name })}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                          >
                            Edit Season
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Teams */}
        {activeTab === "teams" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15.5px" }}>Team Registrations</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Click any team name to edit details or reassign divisions.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <select
                  value={selectedDivisionFilter}
                  onChange={(e) => setSelectedDivisionFilter(e.target.value)}
                  style={{
                    background: "#081017",
                    color: "var(--text)",
                    border: "1px solid #1e3347",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <option value="all">All Divisions ({teams.length})</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(true)}
                  className="button button-sm primary"
                  style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                  disabled={divisions.length === 0}
                >
                  + Add Team
                </button>
              </div>
            </div>

            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>TEAM NAME (CLICK TO EDIT)</th>
                    <th>DIVISION</th>
                    <th>SEASON</th>
                    <th style={{ textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((t) => (
                    <tr key={t.entry_id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            const curDiv = divisions.find((d) => d.name === t.division_name);
                            setEditTeamModal({
                              entryId: t.entry_id,
                              teamId: t.id,
                              name: t.name,
                              divisionId: curDiv?.id || divisions[0]?.id || "",
                            });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: primaryColor,
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            textDecoration: "underline",
                            textAlign: "left",
                          }}
                          title="Click to edit team"
                        >
                          {t.name} ✏️
                        </button>
                      </td>
                      <td>
                        <span className="badge" style={{ fontSize: "10.5px" }}>
                          {t.division_name}
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: "12px" }}>{t.season_name}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setRosterTeamFilter(t.entry_id);
                              setTab("rosters");
                            }}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                          >
                            Roster →
                          </button>
                          <Link
                            href={`/teams/${t.entry_id}`}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                          >
                            Public Page ↗
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTeams.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No teams found for this division filter. Click "+ Add Team" to register club entries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Rosters (Filters, + Add Player Modal, Clean Table per Video 1 & 2) */}
        {activeTab === "rosters" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Header + Add Player Action */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15.5px" }}>Player Rosters &amp; Clearance Pipeline</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Monitor player clearance, jersey numbers, and waiver compliance.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span className="badge" style={{ fontSize: "11px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "4px 10px" }}>
                  {filteredRoster.filter((p) => p.status === "active").length} Cleared
                </span>
                <span className="badge" style={{ fontSize: "11px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "4px 10px" }}>
                  {filteredRoster.filter((p) => p.status !== "active").length} Waiver Needed
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(true)}
                  className="button button-sm primary"
                  style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                  disabled={teams.length === 0}
                >
                  + Add Player
                </button>
              </div>
            </div>

            {/* Filter Bar: Season, Division, Team, Clearance Status per Video 1 & 2 */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", background: "#091219", padding: "12px 16px", borderRadius: "10px", border: "1px solid #162634" }}>
              <select
                value={rosterSeasonFilter}
                onChange={(e) => setRosterSeasonFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={rosterDivisionFilter}
                onChange={(e) => setRosterDivisionFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Divisions</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={rosterTeamFilter}
                onChange={(e) => setRosterTeamFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Teams</option>
                {teams.map((t) => (
                  <option key={t.entry_id} value={t.entry_id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={rosterStatusFilter}
                onChange={(e) => setRosterStatusFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Statuses</option>
                <option value="cleared">🟢 Cleared to Play</option>
                <option value="waiver">🟠 Waiver Needed</option>
              </select>
            </div>

            {/* Rosters Table (Cleaned up, redundant buttons removed per Video 1) */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12.5px" }}>
                <thead>
                  <tr>
                    <th>PLAYER NAME</th>
                    <th>TEAM</th>
                    <th>JERSEY #</th>
                    <th>POSITION</th>
                    <th style={{ textAlign: "right" }}>CLEARANCE STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((p) => {
                    const isCleared = p.status === "active";
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ color: "#f0f4f8" }}>{p.playerName}</strong>
                        </td>
                        <td>
                          <span className="badge" style={{ fontSize: "10.5px" }}>{p.teamName}</span>
                        </td>
                        <td>{p.jerseyNumber ? `#${p.jerseyNumber}` : "-"}</td>
                        <td><span style={{ fontWeight: 700 }}>{p.position}</span></td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: "10.5px",
                              background: isCleared ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.18)",
                              color: isCleared ? "#10b981" : "#f59e0b",
                            }}
                          >
                            {isCleared ? "🟢 Cleared to Play" : "🟠 Waiver Needed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No players found for current filters. Click "+ Add Player" to register athletes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Schedule & Embedded Game Centre (Filters, "+ Add", Embedded Console per Video 2) */}
        {activeTab === "schedule" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0c1822", padding: "16px 20px", borderRadius: "12px", border: "1px solid #162634", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15.5px" }}>Match Schedule Management</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Add fixtures or bulk upload CSV schedules. Expected format: <code>Date, Time, Home Team, Away Team, Arena, Rink</code>.
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
                  + Add
                </button>
                <ScheduleImporter
                  leagueId={league.id}
                  entries={entriesForSchedule}
                  venues={venues}
                  rinks={rinks}
                />
              </div>
            </div>

            {/* Schedule Filters: Season, Division, Team per Video 2 */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", background: "#091219", padding: "12px 16px", borderRadius: "10px", border: "1px solid #162634" }}>
              <select
                value={scheduleSeasonFilter}
                onChange={(e) => setScheduleSeasonFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={scheduleDivisionFilter}
                onChange={(e) => setScheduleDivisionFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Divisions</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={scheduleTeamFilter}
                onChange={(e) => setScheduleTeamFilter(e.target.value)}
                style={{ background: "#0c1822", color: "#f0f4f8", border: "1px solid #1e3347", borderRadius: "6px", padding: "6px 10px", fontSize: "12px" }}
              >
                <option value="all">All Teams</option>
                {teams.map((t) => (
                  <option key={t.entry_id} value={t.entry_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduled Matches Table */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #162634" }}>
                <h4 style={{ margin: 0, fontSize: "13.5px" }}>Scheduled Fixtures ({filteredGames.length})</h4>
              </div>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "140px" }}>DATE &amp; TIME</th>
                    <th>HOME TEAM</th>
                    <th>AWAY TEAM</th>
                    <th>ARENA / RINK</th>
                    <th style={{ width: "100px", textAlign: "right" }}>STATUS</th>
                    <th style={{ width: "140px", textAlign: "right" }}>GAME CENTRE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.map((g) => {
                    const isSelected = selectedGameId === g.id;
                    return (
                      <tr
                        key={g.id}
                        style={{
                          background: isSelected ? "rgba(255, 255, 255, 0.04)" : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedGameId(g.id)}
                      >
                        <td>{new Date(g.starts_at).toLocaleDateString()} · {new Date(g.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td><strong>{g.home_name}</strong></td>
                        <td><strong>{g.away_name}</strong></td>
                        <td style={{ color: "var(--muted)" }}>{g.rink_name}</td>
                        <td style={{ textAlign: "right" }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: "9.5px",
                              background: g.status === "final" ? "rgba(16, 185, 129, 0.2)" : g.status === "in_progress" ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.08)",
                              color: g.status === "final" ? "#10b981" : g.status === "in_progress" ? "#f87171" : "var(--muted)",
                            }}
                          >
                            {g.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGameId(g.id);
                            }}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                          >
                            ⏱️ Select Game
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredGames.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                        No fixtures scheduled for current filters. Click "+ Add" or use the Bulk Importer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Embedded Game Centre Console per Video 2 */}
            {activeSelectedGame && (
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: primaryColor, textTransform: "uppercase", letterSpacing: "1px" }}>
                      EMBEDDED GAME CENTRE CONSOLE
                    </span>
                    <h3 style={{ margin: "2px 0 0", fontSize: "18px" }}>
                      {activeSelectedGame.away_name} @ {activeSelectedGame.home_name}
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                      {new Date(activeSelectedGame.starts_at).toLocaleDateString()} · {activeSelectedGame.rink_name}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <label style={{ fontSize: "12px", color: "var(--muted)", marginRight: "4px" }}>Match Status:</label>
                    <select
                      value={activeSelectedGame.status}
                      disabled={gameStatusPending}
                      onChange={(e) => handleUpdateGameStatus(activeSelectedGame.id, e.target.value as any)}
                      style={{
                        background: "#081017",
                        color: activeSelectedGame.status === "final" ? "#10b981" : activeSelectedGame.status === "in_progress" ? "#f87171" : "#f0f4f8",
                        border: "1px solid #1e3347",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">Live / In Progress</option>
                      <option value="final">Played (Locked)</option>
                    </select>

                    <Link
                      href={`/schedule/${activeSelectedGame.id}/scorekeeping`}
                      className="button button-sm primary"
                      style={{ fontSize: "12px", padding: "6px 12px", fontWeight: 700, textDecoration: "none" }}
                    >
                      Launch Live Scorekeeper ↗
                    </Link>
                  </div>
                </div>

                {gameStatusMsg && (
                  <p style={{ fontSize: "12px", color: gameStatusMsg.startsWith("✓") ? "#10b981" : "#f87171", margin: "0 0 12px" }}>
                    {gameStatusMsg}
                  </p>
                )}

                <div style={{ background: "#081017", padding: "14px", borderRadius: "8px", border: "1px solid #162634", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {activeSelectedGame.status === "final" ? (
                      <span>🔒 <strong>Game Locked:</strong> Result is marked Played. Scores are locked against standard timekeeper edits unless overridden by commissioner.</span>
                    ) : (
                      <span>⏱️ <strong>Active Match:</strong> Timekeepers can record goals, penalties, and period clocks in the Scorekeeper console.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Settings (Top Right Access per Video 1) */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Branding Color Picker */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>Public Website Brand Color Palette</h3>
              <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--muted)" }}>
                Choose the brand accent color for your public league website (e.g. Wave Blue, Orange, Neon Lime).
              </p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                {BRAND_COLOR_PRESETS.map((preset) => {
                  const isSelected = primaryColor.toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => handleSaveBranding(preset.hex)}
                      disabled={isBrandingPending}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        background: isSelected ? "rgba(255,255,255,0.12)" : "#081017",
                        border: isSelected ? `2px solid ${preset.hex}` : "1px solid #1e3347",
                        color: "#f0f4f8",
                        cursor: "pointer",
                        fontSize: "12.5px",
                        fontWeight: isSelected ? 800 : 500,
                      }}
                    >
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          background: preset.hex,
                          display: "inline-block",
                        }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>

              {brandingMsg && (
                <p style={{ margin: 0, fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
                  ✓ {brandingMsg}
                </p>
              )}
            </div>

            {/* Custom Domain Settings */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>Custom Domain Name</h3>
              <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "var(--muted)" }}>
                Route your public league portal to your custom web domain.
              </p>
              <form onSubmit={handleSaveDomain} style={{ display: "flex", gap: "10px", maxWidth: "500px" }}>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g. wavehockey.com"
                  style={{
                    flex: 1,
                    background: "#081017",
                    border: "1px solid #1e3347",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#f0f4f8",
                    fontSize: "13px",
                  }}
                />
                <button
                  type="submit"
                  disabled={isDomainPending}
                  className="button button-sm primary"
                  style={{ padding: "8px 16px", fontSize: "12.5px", fontWeight: 700 }}
                >
                  {isDomainPending ? "Saving…" : "Save Domain"}
                </button>
              </form>
              {domainMsg && (
                <p style={{ margin: "8px 0 0", fontSize: "12px", color: domainMsg.type === "success" ? "#10b981" : "#f87171" }}>
                  {domainMsg.text}
                </p>
              )}
            </div>

            {/* Staff & Governance Management */}
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>League Officials &amp; Staff</h3>
              <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "var(--muted)" }}>
                Assign commissioners, scorekeepers, and referees.
              </p>
              <form onSubmit={handleAddStaff} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="official@example.com"
                  required
                  style={{
                    minWidth: "240px",
                    background: "#081017",
                    border: "1px solid #1e3347",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#f0f4f8",
                    fontSize: "13px",
                  }}
                />
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  style={{
                    background: "#081017",
                    border: "1px solid #1e3347",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#f0f4f8",
                    fontSize: "13px",
                  }}
                >
                  <option value="commissioner">Commissioner</option>
                  <option value="referee">Referee</option>
                  <option value="scorekeeper">Scorekeeper</option>
                </select>
                <button
                  type="submit"
                  disabled={isStaffPending}
                  className="button button-sm primary"
                  style={{ padding: "8px 16px", fontSize: "12.5px", fontWeight: 700 }}
                >
                  {isStaffPending ? "Adding…" : "Assign Staff"}
                </button>
              </form>

              {staffMsg && (
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: staffMsg.type === "success" ? "#10b981" : "#f87171" }}>
                  {staffMsg.text}
                </p>
              )}

              <div style={{ borderTop: "1px solid #162634", paddingTop: "12px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                  Active Governance Personnel ({staff.length})
                </span>
                {staff.map((s) => (
                  <div
                    key={`${s.user_id}-${s.role}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "#081017",
                      borderRadius: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{s.email}</span>
                      <span className="badge" style={{ marginLeft: "8px", fontSize: "10px" }}>{s.role}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStaff(s.user_id, s.role)}
                      disabled={isStaffPending}
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px" }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Standings Rules & Tiebreakers */}
            {settings && (
              <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "20px" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>Competition Rules &amp; Overtime Settings</h3>
                <SeasonSettingsForm
                  seasonId={settings.season_id || seasons[0]?.id || ""}
                  settings={settings}
                  canManage={true}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: Add Season Modal */}
      {showAddSeasonModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>+ Add New Season</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Create a new competition session (e.g. Winter 2026, Summer 2027).
            </p>
            <form onSubmit={handleCreateSeason}>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Season Name</span>
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g. Winter 2026"
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>
              {seasonActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{seasonActionMsg}</p>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddSeasonModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={seasonActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {seasonActionPending ? "Saving…" : "Create Season"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Season Modal (Drill-down per Video 1) */}
      {editingSeason && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Edit Season</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Update the name for this competition session.
            </p>
            <form onSubmit={handleUpdateSeason}>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Season Name</span>
                <input
                  type="text"
                  value={editingSeason.name}
                  onChange={(e) => setEditingSeason({ ...editingSeason, name: e.target.value })}
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>
              {seasonActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{seasonActionMsg}</p>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setEditingSeason(null)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={seasonActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {seasonActionPending ? "Updating…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Division Modal */}
      {showAddDivisionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>+ Add New Division</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Create a flight or tier (e.g. Premier, Division B, Masters).
            </p>
            <form onSubmit={handleCreateDivision}>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Division Name</span>
                <input
                  type="text"
                  value={newDivisionName}
                  onChange={(e) => setNewDivisionName(e.target.value)}
                  placeholder="e.g. Premier Flight"
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Parent Season</span>
                <select
                  value={newDivisionSeasonId}
                  onChange={(e) => setNewDivisionSeasonId(e.target.value)}
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              {divisionActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{divisionActionMsg}</p>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddDivisionModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={divisionActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {divisionActionPending ? "Saving…" : "Create Division"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Division Modal (Drill-down per Video 1) */}
      {editingDivision && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Edit Division</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Update division name or reassign to another season.
            </p>
            <form onSubmit={handleUpdateDivision}>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Division Name</span>
                <input
                  type="text"
                  value={editingDivision.name}
                  onChange={(e) => setEditingDivision({ ...editingDivision, name: e.target.value })}
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Season</span>
                <select
                  value={editingDivision.season_id}
                  onChange={(e) => setEditingDivision({ ...editingDivision, season_id: e.target.value })}
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              {divisionActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{divisionActionMsg}</p>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setEditingDivision(null)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={divisionActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {divisionActionPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Add Team Modal */}
      {showAddTeamModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>+ Add Team to League</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Register a team into an active division.
            </p>
            <form onSubmit={handleCreateTeam}>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Team Name</span>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Northern Wolves"
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Assigned Division</span>
                <select
                  value={newTeamDivisionId}
                  onChange={(e) => setNewTeamDivisionId(e.target.value)}
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                >
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.season_name})</option>
                  ))}
                </select>
              </label>
              {teamActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{teamActionMsg}</p>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddTeamModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={teamActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {teamActionPending ? "Saving…" : "Add Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Edit Team Modal */}
      {editTeamModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "420px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Edit Team Details</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Update team name or transfer between divisions.
            </p>
            <form onSubmit={handleUpdateTeam}>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Team Name</span>
                <input
                  type="text"
                  value={editTeamModal.name}
                  onChange={(e) => setEditTeamModal({ ...editTeamModal, name: e.target.value })}
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Division</span>
                <select
                  value={editTeamModal.divisionId}
                  onChange={(e) => setEditTeamModal({ ...editTeamModal, divisionId: e.target.value })}
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                >
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.season_name})</option>
                  ))}
                </select>
              </label>
              {teamActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{teamActionMsg}</p>
              )}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setEditTeamModal(null)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={teamActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {teamActionPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Add Player Modal (Rosters Tab per Video 1) */}
      {showAddPlayerModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>+ Add Player to Roster</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Directly assign an athlete to an active team roster with jersey and position.
            </p>
            <form onSubmit={handleCreatePlayer}>
              <label style={{ display: "block", marginBottom: "12px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Player Full Name</span>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g. Connor Bedard"
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>

              <label style={{ display: "block", marginBottom: "12px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Assigned Team</span>
                <select
                  value={newPlayerTeamEntryId}
                  onChange={(e) => setNewPlayerTeamEntryId(e.target.value)}
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                >
                  {teams.map((t) => (
                    <option key={t.entry_id} value={t.entry_id}>{t.name} ({t.division_name})</option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <label>
                  <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Jersey #</span>
                  <input
                    type="number"
                    value={newPlayerJersey}
                    onChange={(e) => setNewPlayerJersey(e.target.value)}
                    placeholder="e.g. 97"
                    min="0"
                    max="99"
                    style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                  />
                </label>

                <label>
                  <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Position</span>
                  <select
                    value={newPlayerPosition}
                    onChange={(e) => setNewPlayerPosition(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    <option value="F">Forward (F)</option>
                    <option value="D">Defense (D)</option>
                    <option value="G">Goalie (G)</option>
                  </select>
                </label>
              </div>

              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Clearance Status</span>
                <select
                  value={newPlayerStatus}
                  onChange={(e) => setNewPlayerStatus(e.target.value)}
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                >
                  <option value="active">🟢 Cleared to Play</option>
                  <option value="pending">🟠 Waiver Needed</option>
                </select>
              </label>

              {playerActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{playerActionMsg}</p>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddPlayerModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={playerActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {playerActionPending ? "Adding…" : "Add to Roster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: Add Game Modal */}
      {showAddGameModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ background: "#0c1822", border: "1px solid #1e3347", borderRadius: "14px", padding: "24px", maxWidth: "440px", width: "100%" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>+ Schedule Match Fixture</h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Schedule a game matchup between two teams in this league.
            </p>
            <form onSubmit={handleCreateGame}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <label>
                  <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Home Team</span>
                  <select
                    value={gameHomeEntry}
                    onChange={(e) => setGameHomeEntry(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {teams.map((t) => (
                      <option key={t.entry_id} value={t.entry_id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Away Team</span>
                  <select
                    value={gameAwayEntry}
                    onChange={(e) => setGameAwayEntry(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {teams.map((t) => (
                      <option key={t.entry_id} value={t.entry_id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ display: "block", marginBottom: "12px" }}>
                <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Date &amp; Start Time</span>
                <input
                  type="datetime-local"
                  value={gameStartsAt}
                  onChange={(e) => setGameStartsAt(e.target.value)}
                  required
                  style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                />
              </label>

              {rinks.length > 0 && (
                <label style={{ display: "block", marginBottom: "14px" }}>
                  <span style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Rink / Venue</span>
                  <select
                    value={gameRinkId}
                    onChange={(e) => setGameRinkId(e.target.value)}
                    style={{ width: "100%", background: "#081017", border: "1px solid #1e3347", borderRadius: "8px", padding: "8px 12px", color: "#f0f4f8", fontSize: "13px" }}
                  >
                    {rinks.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {gameActionMsg && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>{gameActionMsg}</p>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowAddGameModal(false)} className="button button-outline" style={{ fontSize: "12px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={gameActionPending} className="button primary" style={{ fontSize: "12px", fontWeight: 700 }}>
                  {gameActionPending ? "Scheduling…" : "Save Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
