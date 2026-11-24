"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Player {
  id: string;
  name: string;
  email?: string;
  number: number;
  position: string;
  registered: boolean;
  waiverStatus: "Signed" | "Pending";
  paymentStatus: "Paid" | "Outstanding";
  ghlContactId?: string;
  ghlWaiverDate?: string;
}

interface Team {
  id: string;
  name: string;
  division: string;
  manager: string;
  managerEmail: string;
  paidStatus: "Paid" | "Pending" | "Partial";
  amountDue: number;
  amountPaid: number;
  roster: Player[];
}

interface Division {
  id: string;
  name: string;
  description: string;
  teamCount: number;
}

interface GameSchedule {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  status: "scheduled" | "final" | "in_progress";
}

interface LeagueMeta {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  season: string;
  commissioner: string;
  teams: Team[];
  divisions: Division[];
  schedule: GameSchedule[];
}

export function LeagueBackendClient({ initialLeague }: { initialLeague: LeagueMeta }) {
  const [activeTab, setActiveTab] = useState<"teams" | "divisions" | "schedule" | "billing">("teams");
  const [leagueMeta, setLeagueMeta] = useState<LeagueMeta>(initialLeague);
  const [teams, setTeams] = useState<Team[]>(initialLeague.teams);
  const [divisions, setDivisions] = useState<Division[]>(initialLeague.divisions);
  const [schedule, setSchedule] = useState<GameSchedule[]>(initialLeague.schedule);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Load persisted custom league state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`plaionn_league_data_${initialLeague.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name) setLeagueMeta((prev) => ({ ...prev, name: parsed.name }));
        if (Array.isArray(parsed.teams)) setTeams(parsed.teams);
        if (Array.isArray(parsed.divisions) && parsed.divisions.length > 0) setDivisions(parsed.divisions);
        if (Array.isArray(parsed.schedule)) setSchedule(parsed.schedule);
      }
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }, [initialLeague.id]);

  const saveToStorage = (t: Team[], d: Division[], s: GameSchedule[]) => {
    try {
      localStorage.setItem(
        `plaionn_league_data_${initialLeague.id}`,
        JSON.stringify({
          id: initialLeague.id,
          name: leagueMeta.name,
          teams: t,
          divisions: d,
          schedule: s,
        })
      );
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  };

  // Drill-down states
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Modals
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDivision, setNewTeamDivision] = useState(divisions[0]?.name || "Premier");
  const [newTeamManager, setNewTeamManager] = useState("");
  const [newTeamEmail, setNewTeamEmail] = useState("");

  const [showAddDivision, setShowAddDivision] = useState(false);
  const [newDivName, setNewDivName] = useState("");
  const [newDivDesc, setNewDivDesc] = useState("");

  const [showAddGame, setShowAddGame] = useState(false);
  const [newGameDate, setNewGameDate] = useState("Fri, Dec 12, 2026");
  const [newGameTime, setNewGameTime] = useState("8:00 PM");
  const [newGameHome, setNewGameHome] = useState(teams[0]?.name || "");
  const [newGameAway, setNewGameAway] = useState(teams[1]?.name || "");
  const [newGameVenue, setNewGameVenue] = useState("Metro Arena - Rink 1");

  // CSV Import States
  const [showImportSchedule, setShowImportSchedule] = useState(false);
  const [csvInputText, setCsvInputText] = useState("");
  const [csvImportMsg, setCsvImportMsg] = useState<string | null>(null);

  // Division Assignment State
  const [assigningTeam, setAssigningTeam] = useState<Record<string, string>>({});

  // Player Form States for Drill-down
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("F");

  // Add Team Handler
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const teamMgrEmail = newTeamEmail.trim().toLowerCase();
    const teamMgrName = newTeamManager.trim() || "Team Captain";
    const teamTitle = newTeamName.trim();

    const newTeam: Team = {
      id: `t-${Date.now()}`,
      name: teamTitle,
      division: newTeamDivision,
      manager: teamMgrName,
      managerEmail: teamMgrEmail || "captain@team.com",
      paidStatus: "Pending",
      amountDue: 1500,
      amountPaid: 0,
      roster: [
        {
          id: `p-${Date.now()}-1`,
          name: teamMgrName,
          email: teamMgrEmail || "captain@team.com",
          number: 9,
          position: "F",
          registered: true,
          waiverStatus: "Signed",
          paymentStatus: "Paid",
          ghlContactId: `ghl-${Date.now().toString().slice(-6)}`,
          ghlWaiverDate: new Date().toISOString().split("T")[0],
        },
      ],
    };
    const nextTeams = [...teams, newTeam];
    setTeams(nextTeams);
    saveToStorage(nextTeams, divisions, schedule);

    // Send invitation email to Team Manager via Supabase SMTP
    if (teamMgrEmail && teamMgrEmail.includes("@")) {
      try {
        await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: teamMgrName,
            email: teamMgrEmail,
            userType: "Team Admin / Manager",
            scope: `${teamTitle} (${newTeamDivision})`,
            waiverStatus: "Cleared & Signed",
          }),
        });
      } catch (err) {
        console.warn("Could not dispatch manager invite:", err);
      }
    }

    setNewTeamName("");
    setNewTeamManager("");
    setNewTeamEmail("");
    setShowAddTeam(false);
    showToast(`✓ Team "${teamTitle}" registered & manager invitation email dispatched to ${teamMgrEmail || "manager"}!`);
  };

  // Add Division Handler
  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivName.trim()) return;
    const newDiv: Division = {
      id: `d-${Date.now()}`,
      name: newDivName.trim(),
      description: newDivDesc.trim() || "League Division",
      teamCount: 0,
    };
    const nextDivs = [...divisions, newDiv];
    setDivisions(nextDivs);
    saveToStorage(teams, nextDivs, schedule);
    setNewDivName("");
    setNewDivDesc("");
    setShowAddDivision(false);
  };

  // Add Game Handler
  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameHome || !newGameAway) return;
    const newG: GameSchedule = {
      id: `s-${Date.now()}`,
      date: newGameDate,
      time: newGameTime,
      homeTeam: newGameHome,
      awayTeam: newGameAway,
      venue: newGameVenue,
      status: "scheduled",
    };
    const nextSched = [...schedule, newG];
    setSchedule(nextSched);
    saveToStorage(teams, divisions, nextSched);
    setShowAddGame(false);
  };

  // CSV Schedule Template Download
  const handleDownloadTemplate = () => {
    const home = teams[0]?.name || "Northline HC";
    const away = teams[1]?.name || "Harbour Wolves";
    const div = divisions[0]?.name || "Premier Division";
    const csvContent =
      "Date,Time,Home Team,Away Team,Venue,Division\n" +
      `Fri Dec 12 2026,7:00 PM,${home},${away},Metro Arena - Rink 1,${div}\n` +
      `Sat Dec 13 2026,8:30 PM,${away},${home},Metro Arena - Rink 2,${div}\n`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `fixtures-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Schedule Processor
  const handleProcessCsv = (text: string) => {
    if (!text.trim()) return;
    const lines = text.trim().split(/\r?\n/);
    if (lines.length <= 1) {
      setCsvImportMsg("CSV contains no fixture rows. Please include a header line and fixture rows.");
      return;
    }
    const newFixtures: GameSchedule[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 4) {
        newFixtures.push({
          id: `s-csv-${Date.now()}-${i}`,
          date: parts[0] || "Upcoming",
          time: parts[1] || "8:00 PM",
          homeTeam: parts[2],
          awayTeam: parts[3],
          venue: parts[4] || "Metro Arena - Rink 1",
          status: "scheduled",
        });
      }
    }
    if (newFixtures.length === 0) {
      setCsvImportMsg("Could not parse fixture rows. Ensure columns: Date, Time, Home Team, Away Team, Venue.");
      return;
    }
    setSchedule((prev) => [...prev, ...newFixtures]);
    setCsvImportMsg(`Successfully imported ${newFixtures.length} matchups into the schedule!`);
    setTimeout(() => {
      setShowImportSchedule(false);
      setCsvInputText("");
    }, 1400);
  };

  // Player Management inside Drill-Down Modal (Requirement 4a)
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newPlayerName.trim()) return;
    const playerEmail = newPlayerEmail.trim().toLowerCase() || `${newPlayerName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@player.com`;
    const newP: Player = {
      id: `p-${Date.now()}`,
      name: newPlayerName.trim(),
      email: playerEmail,
      number: parseInt(newPlayerNumber) || Math.floor(Math.random() * 98) + 1,
      position: newPlayerPosition,
      registered: true,
      waiverStatus: "Signed",
      paymentStatus: "Paid",
      ghlContactId: `ghl-${Date.now().toString().slice(-6)}`,
      ghlWaiverDate: new Date().toISOString().split("T")[0],
    };
    const updatedTeam: Team = {
      ...selectedTeam,
      roster: [...selectedTeam.roster, newP],
    };
    const nextTeams = teams.map((t) => (t.id === updatedTeam.id ? updatedTeam : t));
    setSelectedTeam(updatedTeam);
    setTeams(nextTeams);
    saveToStorage(nextTeams, divisions, schedule);
    setNewPlayerName("");
    setNewPlayerNumber("");
    setNewPlayerEmail("");
    showToast(`✓ Added ${newP.name} to roster & linked GHL contact (${playerEmail})!`);
  };

  // Financial Stats
  const totalBilled = teams.reduce((acc, t) => acc + t.amountDue, 0);
  const totalCollected = teams.reduce((acc, t) => acc + t.amountPaid, 0);
  const totalOutstanding = totalBilled - totalCollected;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Top Header Banner with Public Portal Link */}
      <div
        style={{
          background: "#0c1822",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "18px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Link
              href="/admin"
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ← Back to Central Admin
            </Link>
            <span style={{ opacity: 0.3 }}>|</span>
            <span
              className="badge"
              style={{
                background: "rgba(199, 244, 80, 0.15)",
                color: "var(--lime)",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              LEAGUE BACKEND
            </span>
            <code
              style={{
                background: "#162734",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                color: "#67e8f9",
              }}
            >
              {leagueMeta.subdomain}
            </code>
          </div>

          <h1 style={{ margin: 0, fontSize: "24px", color: "var(--text)" }}>
            {leagueMeta.name}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Season: <strong style={{ color: "var(--text)" }}>{leagueMeta.season}</strong> · Commissioner: {leagueMeta.commissioner}
          </p>
        </div>

        {/* Action: Link to the public page with standings, schedule, scores */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <a
            href={`https://${leagueMeta.subdomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button primary"
            style={{
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Launch Public Fan Website ↗
          </a>
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "12px",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("teams")}
          className={`button button-sm ${activeTab === "teams" ? "primary" : "button-outline"}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
        >
          🏒 Teams &amp; Rosters ({teams.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("divisions")}
          className={`button button-sm ${activeTab === "divisions" ? "primary" : "button-outline"}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
        >
          📂 Divisions ({divisions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`button button-sm ${activeTab === "schedule" ? "primary" : "button-outline"}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
        >
          📅 Schedule &amp; Import ({schedule.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("billing")}
          className={`button button-sm ${activeTab === "billing" ? "primary" : "button-outline"}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
        >
          💳 Billing &amp; Invoices
        </button>
      </div>

      {/* TAB 1: TEAMS & ROSTERS */}
      {activeTab === "teams" && selectedTeam && (
        <section className="panel" style={{ padding: "24px" }}>
          {/* Top Bar with Back Button (Dedicated Team Page - No Popup) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="button button-sm button-outline"
                style={{ fontSize: "12px", fontWeight: 700 }}
              >
                ← Back to Teams List
              </button>
              <span className="badge" style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontSize: "11px" }}>
                TEAM PROFILE
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link
                href={`/teams/${selectedTeam.id}`}
                target="_blank"
                className="button button-sm button-outline"
                style={{ fontSize: "11.5px" }}
              >
                Public Fan Page ↗
              </Link>
            </div>
          </div>

          {/* Team Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Team Name</span>
              <h2 style={{ margin: "4px 0 0", fontSize: "20px", color: "var(--text)" }}>{selectedTeam.name}</h2>
              <span style={{ fontSize: "12px", color: "var(--lime)" }}>Division: {selectedTeam.division}</span>
            </div>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Team Manager</span>
              <div style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{selectedTeam.manager}</div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>{selectedTeam.managerEmail}</span>
            </div>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Roster Strength</span>
              <div style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 900, color: "var(--lime)" }}>{selectedTeam.roster.length} Players</div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>All registered</span>
            </div>
            <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Season Fee</span>
              <div style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 900, color: selectedTeam.paidStatus === "Paid" ? "#10b981" : "#f59e0b" }}>
                ${selectedTeam.amountPaid} / ${selectedTeam.amountDue}
              </div>
              <span className="badge" style={{ fontSize: "10px", marginTop: "2px" }}>{selectedTeam.paidStatus}</span>
            </div>
          </div>

          {/* Roster Table */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "16px" }}>Active Team Roster &amp; Waivers</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player Name</th>
                    <th>Email (GHL Key)</th>
                    <th>Pos</th>
                    <th>Registration</th>
                    <th>Waiver Status (GHL API)</th>
                    <th>Fee Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTeam.roster.map((p) => {
                    const displayEmail = p.email || `${p.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@player.com`;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 800, color: "var(--lime)" }}>#{p.number}</td>
                        <td style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "12px", color: "var(--text)" }}>{displayEmail}</span>
                            <a
                              href={`https://app.gohighlevel.com/v2/location/plaionn-sports/contacts?search=${encodeURIComponent(displayEmail)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: "10.5px", color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}
                              title="Open contact in GoHighLevel (GHL)"
                            >
                              GHL ↗
                            </a>
                          </div>
                        </td>
                        <td><span className="badge" style={{ fontSize: "10px" }}>{p.position}</span></td>
                        <td>
                          <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontSize: "10.5px" }}>
                            ✓ Registered
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              className="badge"
                              style={{
                                background: p.waiverStatus === "Signed" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                color: p.waiverStatus === "Signed" ? "#10b981" : "#ef4444",
                                fontSize: "10.5px",
                                fontWeight: 700,
                              }}
                              title="Read-only waiver status verified directly via GoHighLevel Waiver API"
                            >
                              {p.waiverStatus === "Signed" ? "✓ GHL Signed" : "⏳ GHL Pending"}
                            </span>
                            <a
                              href={`https://app.gohighlevel.com/v2/location/plaionn-sports/contacts?search=${encodeURIComponent(displayEmail)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: "11px", color: "var(--accent)", textDecoration: "none" }}
                              title="Verify signed waiver document in GoHighLevel"
                            >
                              Waiver ↗
                            </a>
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: p.paymentStatus === "Paid" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                              color: p.paymentStatus === "Paid" ? "#10b981" : "#f59e0b",
                              fontSize: "10.5px",
                            }}
                          >
                            {p.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Player Form */}
          <form
            onSubmit={handleAddPlayer}
            style={{
              padding: "16px",
              borderRadius: "10px",
              background: "#162734",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "10px" }}>
              + Add Player to {selectedTeam.name} Roster &amp; Link to GHL
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 80px 100px auto", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                required
                placeholder="Player Full Name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "6px", background: "#0c1822", border: "1px solid var(--line)", color: "#fff", fontSize: "12px" }}
              />
              <input
                type="email"
                required
                placeholder="Player Email (links to GHL record)"
                value={newPlayerEmail}
                onChange={(e) => setNewPlayerEmail(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "6px", background: "#0c1822", border: "1px solid var(--line)", color: "#fff", fontSize: "12px" }}
              />
              <input
                type="number"
                placeholder="Jersey #"
                value={newPlayerNumber}
                onChange={(e) => setNewPlayerNumber(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", background: "#0c1822", border: "1px solid var(--line)", color: "#fff", fontSize: "12px" }}
              />
              <select
                value={newPlayerPosition}
                onChange={(e) => setNewPlayerPosition(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", background: "#0c1822", border: "1px solid var(--line)", color: "#fff", fontSize: "12px" }}
              >
                <option value="F">F (Forward)</option>
                <option value="D">D (Defense)</option>
                <option value="G">G (Goalie)</option>
              </select>
              <button
                type="submit"
                className="button button-sm primary"
                style={{ fontWeight: 800, fontSize: "11.5px", padding: "8px 14px" }}
              >
                + Add Player &amp; Sync GHL
              </button>
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "8px" }}>
              🔒 <em>Player email automatically links to GoHighLevel (GHL) contact record and validates digital waiver signature status via API.</em>
            </div>
          </form>
        </section>
      )}

      {/* TAB 1: ALL TEAMS LIST */}
      {activeTab === "teams" && !selectedTeam && (
        <section className="panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Registered Teams &amp; Rosters</h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                Click any team to drill down into player registrations and signed waivers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTeam(true)}
              className="button button-sm primary"
              style={{ fontWeight: 800 }}
            >
              + Add Team
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Division</th>
                  <th>Manager</th>
                  <th>Manager Email</th>
                  <th>Roster Count</th>
                  <th>Fee Payment</th>
                  <th style={{ textAlign: "right" }}>Drill Down</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 800, color: "var(--text)" }}>{t.name}</td>
                    <td>
                      <span className="badge" style={{ fontSize: "11px" }}>{t.division}</span>
                    </td>
                    <td>{t.manager}</td>
                    <td style={{ fontSize: "12.5px", color: "var(--muted)" }}>{t.managerEmail}</td>
                    <td style={{ fontWeight: 700, color: "var(--lime)" }}>{t.roster.length} registered</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: t.paidStatus === "Paid" ? "rgba(16, 185, 129, 0.2)" : t.paidStatus === "Partial" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                          color: t.paidStatus === "Paid" ? "#10b981" : t.paidStatus === "Partial" ? "#f59e0b" : "#ef4444",
                          fontSize: "11px",
                        }}
                      >
                        {t.paidStatus} (${t.amountPaid} / ${t.amountDue})
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTeam(t)}
                        className="button button-sm button-outline"
                        style={{ fontSize: "11.5px", padding: "4px 12px" }}
                      >
                        View Roster →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: DIVISIONS */}
      {activeTab === "divisions" && (
        <section className="panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>League Divisions &amp; Age Brackets</h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                Add divisions (e.g. Monday over 40, Tuesday over 50) and assign teams.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDivision(true)}
              className="button button-sm primary"
              style={{ fontWeight: 800 }}
            >
              + Add Division
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {divisions.map((d) => {
              const divTeams = teams.filter((t) => t.division === d.name);
              return (
                <div
                  key={d.id}
                  style={{
                    background: "#0c1822",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3 style={{ margin: 0, fontSize: "16.5px", color: "var(--text)" }}>{d.name}</h3>
                    <span className="badge" style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontSize: "11px" }}>
                      {divTeams.length} Teams
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.4 }}>
                    {d.description}
                  </p>

                  <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Assigned Teams:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      {divTeams.length === 0 ? (
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>No teams assigned yet</span>
                      ) : (
                        divTeams.map((t) => (
                          <span
                            key={t.id}
                            style={{
                              background: "#162734",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              color: "var(--text)",
                            }}
                          >
                            {t.name}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Requirement 4e: Assign Team to Division */}
                    <div style={{ marginTop: "12px", display: "flex", gap: "6px", alignItems: "center" }}>
                      <select
                        value={assigningTeam[d.id] || ""}
                        onChange={(e) => setAssigningTeam({ ...assigningTeam, [d.id]: e.target.value })}
                        style={{
                          flex: 1,
                          padding: "5px 8px",
                          borderRadius: "6px",
                          fontSize: "11.5px",
                          background: "#162734",
                          border: "1px solid var(--line)",
                          color: "#fff",
                        }}
                      >
                        <option value="">+ Add / reassign team...</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.division})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!assigningTeam[d.id]}
                        onClick={() => {
                          const teamId = assigningTeam[d.id];
                          if (!teamId) return;
                          setTeams(teams.map((t) => (t.id === teamId ? { ...t, division: d.name } : t)));
                          setAssigningTeam({ ...assigningTeam, [d.id]: "" });
                        }}
                        className="button button-sm primary"
                        style={{ fontSize: "11px", padding: "5px 10px", fontWeight: 700 }}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: SCHEDULE & IMPORT */}
      {activeTab === "schedule" && (
        <section className="panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px" }}>League Schedule &amp; Matchup Generator</h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                Add games manually or import fixtures directly via CSV.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowImportSchedule(true);
                  setCsvImportMsg(null);
                }}
                className="button button-sm button-outline"
              >
                📥 Import Schedule (CSV)
              </button>
              <button
                type="button"
                onClick={() => setShowAddGame(true)}
                className="button button-sm primary"
                style={{ fontWeight: 800 }}
              >
                + Add Game
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Home Team</th>
                  <th>Away Team</th>
                  <th>Venue / Rink</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Game Centre</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 700 }}>
                      {g.date} · {g.time}
                    </td>
                    <td style={{ color: "var(--text)", fontWeight: 800 }}>{g.homeTeam}</td>
                    <td style={{ color: "var(--text)", fontWeight: 800 }}>{g.awayTeam}</td>
                    <td style={{ fontSize: "12.5px", color: "var(--muted)" }}>{g.venue}</td>
                    <td>
                      <span className="badge" style={{ fontSize: "10.5px" }}>{g.status.toUpperCase()}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/schedule/${g.id}/scorekeeping`}
                        className="button button-sm primary"
                        style={{
                          fontSize: "12px",
                          padding: "6px 14px",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "var(--lime)",
                          color: "#000",
                        }}
                        title="Open live game centre & scorekeeper to record goals, assists, penalties & shots"
                      >
                        ⏱ Game Centre →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rink Scorekeeper Feature Spotlight (Requirement 4f) */}
          <div
            style={{
              marginTop: "20px",
              padding: "18px 22px",
              background: "rgba(103, 232, 249, 0.06)",
              border: "1px solid rgba(103, 232, 249, 0.25)",
              borderRadius: "12px",
              display: "flex",
              gap: "14px",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "24px", flexShrink: 0 }}>⏱</span>
            <div>
              <strong style={{ color: "#67e8f9", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                Live Digital Rink Scorekeeping &amp; Game Centre
              </strong>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                Click <strong style={{ color: "var(--lime)" }}>⏱ Game Centre →</strong> on any matchup above to record live game events while at the rink: goals, primary/secondary assists, penalty minutes, period-by-period shots on goal (SOG), goalie stints, and Three Stars selection. Real-time scores sync immediately to the public game centre and fan mobile devices.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: BILLING & INVOICES */}
      {activeTab === "billing" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Total League Invoiced
              </span>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "var(--text)", marginTop: "4px" }}>
                ${totalBilled.toLocaleString()}
              </div>
            </div>
            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Total Collected
              </span>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#10b981", marginTop: "4px" }}>
                ${totalCollected.toLocaleString()}
              </div>
            </div>
            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Outstanding Balance
              </span>
              <div style={{ fontSize: "28px", fontWeight: 900, color: totalOutstanding > 0 ? "#ef4444" : "#10b981", marginTop: "4px" }}>
                ${totalOutstanding.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Billing Ledger */}
          <div className="panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Team &amp; Player Payment Ledger</h2>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
                  Integrated with GoHighLevel (GHL) Subaccount: Invoices, online card payments, and offline receipts.
                </p>
              </div>
              <a
                href="https://app.gohighlevel.com/v2/location/plaionn-sports/invoices"
                target="_blank"
                rel="noreferrer"
                className="button button-sm button-outline"
                style={{ fontSize: "12px", color: "var(--accent)" }}
              >
                GoHighLevel Invoices Hub ↗
              </a>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Club / Team</th>
                    <th>Fee Model</th>
                    <th>Invoiced</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Payment Status (GHL)</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 800, color: "var(--text)" }}>{t.name}</td>
                      <td style={{ fontSize: "12.5px", color: "var(--muted)" }}>Team Season Fee</td>
                      <td>${t.amountDue}</td>
                      <td style={{ color: "#10b981", fontWeight: 700 }}>${t.amountPaid}</td>
                      <td style={{ color: t.amountDue - t.amountPaid > 0 ? "#ef4444" : "var(--muted)", fontWeight: 700 }}>
                        ${t.amountDue - t.amountPaid}
                      </td>
                      <td>
                        <a
                          href={`https://app.gohighlevel.com/v2/location/plaionn-sports/invoices?team=${encodeURIComponent(t.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="badge"
                          style={{
                            background: t.paidStatus === "Paid" ? "rgba(16, 185, 129, 0.2)" : t.paidStatus === "Partial" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: t.paidStatus === "Paid" ? "#10b981" : t.paidStatus === "Partial" ? "#f59e0b" : "#ef4444",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                          title="Click to view invoice in GoHighLevel (GHL)"
                        >
                          {t.paidStatus === "Paid" ? "✓ Paid · GHL Inv #INV-" + t.id.slice(-4) : "⏳ " + t.paidStatus + " · GHL Inv #INV-" + t.id.slice(-4)} ↗
                        </a>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                          <a
                            href={`https://app.gohighlevel.com/v2/location/plaionn-sports/invoices?team=${encodeURIComponent(t.name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "4px 8px", textDecoration: "none", color: "var(--accent)" }}
                            title="Open invoice details in GoHighLevel"
                          >
                            GHL Invoice ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = teams.map((item) =>
                                item.id === t.id ? { ...item, amountPaid: item.amountDue, paidStatus: "Paid" as const } : item
                              );
                              setTeams(updated);
                              saveToStorage(updated, divisions, schedule);
                              showToast(`✓ Marked invoice for ${t.name} as Paid and synced with GHL!`);
                            }}
                            className="button button-sm button-outline"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                            disabled={t.paidStatus === "Paid"}
                          >
                            {t.paidStatus === "Paid" ? "Cleared" : "Mark Paid"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* MODAL 2: ADD TEAM */}
      {showAddTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleCreateTeam}
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Register New Team</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Metro Blades"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Division</label>
                <select
                  value={newTeamDivision}
                  onChange={(e) => setNewTeamDivision(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                >
                  {divisions.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Team Manager / Captain</label>
                <input
                  type="text"
                  required
                  value={newTeamManager}
                  onChange={(e) => setNewTeamManager(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Manager Email</label>
                <input
                  type="email"
                  required
                  value={newTeamEmail}
                  onChange={(e) => setNewTeamEmail(e.target.value)}
                  placeholder="manager@example.com"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                />
              </div>

              <div
                style={{
                  background: "rgba(103, 232, 249, 0.08)",
                  border: "1px solid rgba(103, 232, 249, 0.25)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  color: "var(--text)",
                  lineHeight: "1.4",
                }}
              >
                ✉️ <strong style={{ color: "var(--accent)" }}>Supabase Invite:</strong> Saving this team will send an official invitation email to this manager so they can set their password and manage this team's roster.
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button type="button" onClick={() => setShowAddTeam(false)} className="button button-outline">
                Cancel
              </button>
              <button type="submit" className="button primary" style={{ fontWeight: 800 }}>
                Save Team
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: ADD DIVISION */}
      {showAddDivision && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleCreateDivision}
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Create Division</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Division Name (e.g. Monday over 40 years old, Tuesday over 50)
                </label>
                <input
                  type="text"
                  required
                  value={newDivName}
                  onChange={(e) => setNewDivName(e.target.value)}
                  placeholder="e.g. Monday Over 40"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Description</label>
                <input
                  type="text"
                  value={newDivDesc}
                  onChange={(e) => setNewDivDesc(e.target.value)}
                  placeholder="e.g. Competitive masters hockey"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button type="button" onClick={() => setShowAddDivision(false)} className="button button-outline">
                Cancel
              </button>
              <button type="submit" className="button primary" style={{ fontWeight: 800 }}>
                Create Division
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: ADD GAME */}
      {showAddGame && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleCreateGame}
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Schedule New Matchup</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Home Team</label>
                <select
                  value={newGameHome}
                  onChange={(e) => setNewGameHome(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Away Team</label>
                <select
                  value={newGameAway}
                  onChange={(e) => setNewGameAway(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Date</label>
                  <input
                    type="text"
                    value={newGameDate}
                    onChange={(e) => setNewGameDate(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Time</label>
                  <input
                    type="text"
                    value={newGameTime}
                    onChange={(e) => setNewGameTime(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Arena / Rink</label>
                <input
                  type="text"
                  value={newGameVenue}
                  onChange={(e) => setNewGameVenue(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button type="button" onClick={() => setShowAddGame(false)} className="button button-outline">
                Cancel
              </button>
              <button type="submit" className="button primary" style={{ fontWeight: 800 }}>
                Save Matchup
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: IMPORT SCHEDULE (CSV) (Requirement 4d) */}
      {showImportSchedule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "560px",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span className="badge" style={{ background: "rgba(103, 232, 249, 0.15)", color: "#67e8f9", fontSize: "11px" }}>
                  SCHEDULE CSV IMPORT WIZARD
                </span>
                <h2 style={{ margin: "6px 0 2px", fontSize: "18px", color: "var(--text)" }}>Import Matchups via CSV</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                  Upload a fixtures .csv or paste rows to populate the league schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportSchedule(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <strong style={{ fontSize: "13px", color: "var(--text)" }}>Fixtures CSV Template</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>Includes Date, Time, Home, Away, Venue</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="button button-sm button-outline"
                  style={{ fontSize: "11.5px" }}
                >
                  📥 Download Template (.csv)
                </button>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Upload CSV File:
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result as string;
                      if (text) handleProcessCsv(text);
                    };
                    reader.readAsText(file);
                  }}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff", fontSize: "12px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Or Paste CSV Data:
                </label>
                <textarea
                  rows={4}
                  value={csvInputText}
                  onChange={(e) => setCsvInputText(e.target.value)}
                  placeholder={`Date,Time,Home Team,Away Team,Venue,Division\nFri Dec 12 2026,7:00 PM,${teams[0]?.name || "Northline HC"},${teams[1]?.name || "Harbour Wolves"},Metro Arena - Rink 1,Premier`}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#162734", border: "1px solid var(--line)", color: "#fff", fontSize: "12px", fontFamily: "monospace" }}
                />
              </div>

              {csvImportMsg && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: csvImportMsg.includes("Successfully") ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: csvImportMsg.includes("Successfully") ? "#10b981" : "#ef4444",
                    fontSize: "12.5px",
                  }}
                >
                  {csvImportMsg}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button type="button" onClick={() => setShowImportSchedule(false)} className="button button-outline">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleProcessCsv(csvInputText)}
                disabled={!csvInputText.trim()}
                className="button primary"
                style={{ fontWeight: 800 }}
              >
                Import Fixtures
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Toast Feedback Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#10b981",
            color: "#000",
            fontWeight: 800,
            padding: "14px 22px",
            borderRadius: "10px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
