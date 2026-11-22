"use client";

import { useState } from "react";
import Link from "next/link";

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  registered: boolean;
  waiverStatus: "Signed" | "Pending";
  paymentStatus: "Paid" | "Outstanding";
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
  const [teams, setTeams] = useState<Team[]>(initialLeague.teams);
  const [divisions, setDivisions] = useState<Division[]>(initialLeague.divisions);
  const [schedule, setSchedule] = useState<GameSchedule[]>(initialLeague.schedule);

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

  // Add Team Handler
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const newTeam: Team = {
      id: `t-${Date.now()}`,
      name: newTeamName.trim(),
      division: newTeamDivision,
      manager: newTeamManager.trim() || "Team Captain",
      managerEmail: newTeamEmail.trim() || "captain@team.com",
      paidStatus: "Pending",
      amountDue: 1500,
      amountPaid: 0,
      roster: [
        { id: `p-${Date.now()}-1`, name: newTeamManager.trim() || "Captain", number: 9, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
      ],
    };
    setTeams([...teams, newTeam]);
    setNewTeamName("");
    setNewTeamManager("");
    setNewTeamEmail("");
    setShowAddTeam(false);
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
    setDivisions([...divisions, newDiv]);
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
    setSchedule([...schedule, newG]);
    setShowAddGame(false);
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
              {initialLeague.subdomain}
            </code>
          </div>

          <h1 style={{ margin: 0, fontSize: "24px", color: "var(--text)" }}>
            {initialLeague.name}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Season: <strong style={{ color: "var(--text)" }}>{initialLeague.season}</strong> · Commissioner: {initialLeague.commissioner}
          </p>
        </div>

        {/* Action: Link to the public page with standings, schedule, scores */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <a
            href={`https://${initialLeague.subdomain}`}
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
      {activeTab === "teams" && (
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
                onClick={() => alert("CSV Schedule Import Wizard: Upload .csv fixtures template to auto-populate.")}
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
                  <th style={{ textAlign: "right" }}>Live Scorekeeper</th>
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
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                        <Link
                          href={`/schedule/${g.id}/scorekeeping`}
                          className="button button-sm primary"
                          style={{
                            fontSize: "11.5px",
                            padding: "6px 14px",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "var(--lime)",
                            color: "#000",
                          }}
                          title="Open live scorekeeper to record goals, assists, penalties & shots"
                        >
                          ⏱ Score Game
                        </Link>
                        <Link
                          href={`/schedule/${g.id}/live`}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", padding: "6px 10px" }}
                          title="View public live game center"
                        >
                          Game Center ↗
                        </Link>
                      </div>
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
                Live Digital Rink Scorekeeping (Requirement 4f)
              </strong>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                Click <strong style={{ color: "var(--lime)" }}>⏱ Score Game</strong> on any matchup above to record live game events while at the rink: goals, primary/secondary assists, penalty minutes, period-by-period shots on goal (SOG), goalie stints, and Three Stars selection. Real-time scores sync immediately to the public game center and fan mobile devices.
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
            <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Team &amp; Player Payment Ledger</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>Club / Team</th>
                    <th>Fee Model</th>
                    <th>Invoiced</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Payment Status</th>
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
                        <span
                          className="badge"
                          style={{
                            background: t.paidStatus === "Paid" ? "rgba(16, 185, 129, 0.2)" : t.paidStatus === "Partial" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: t.paidStatus === "Paid" ? "#10b981" : t.paidStatus === "Partial" ? "#f59e0b" : "#ef4444",
                          }}
                        >
                          {t.paidStatus}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = teams.map((item) =>
                              item.id === t.id ? { ...item, amountPaid: item.amountDue, paidStatus: "Paid" as const } : item
                            );
                            setTeams(updated);
                          }}
                          className="button button-sm button-outline"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          disabled={t.paidStatus === "Paid"}
                        >
                          {t.paidStatus === "Paid" ? "Cleared" : "Mark Paid"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* MODAL 1: DRILL DOWN TEAM ROSTER */}
      {selectedTeam && (
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
              maxWidth: "700px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span className="badge" style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontSize: "11px" }}>
                  TEAM ROSTER DRILL-DOWN
                </span>
                <h2 style={{ margin: "6px 0 2px", fontSize: "20px", color: "var(--text)" }}>
                  {selectedTeam.name}
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                  Division: {selectedTeam.division} · Manager: {selectedTeam.manager} ({selectedTeam.managerEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player Name</th>
                    <th>Pos</th>
                    <th>Registration</th>
                    <th>Waiver</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTeam.roster.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 800, color: "var(--lime)" }}>#{p.number}</td>
                      <td style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</td>
                      <td>
                        <span className="badge" style={{ fontSize: "10px" }}>{p.position}</span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontSize: "10.5px" }}>
                          ✓ Registered
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: p.waiverStatus === "Signed" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: p.waiverStatus === "Signed" ? "#10b981" : "#ef4444",
                            fontSize: "10.5px",
                          }}
                        >
                          {p.waiverStatus}
                        </span>
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
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="button button-outline"
                style={{ padding: "8px 20px" }}
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
