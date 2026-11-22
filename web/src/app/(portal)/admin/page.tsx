import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";
import { AdminUsersManager } from "@/components/admin-users-manager";

export const dynamic = "force-dynamic";

export default async function AdminManagementPage() {
  const { user, canManage } = await getLeagueContext();

  const leaguesList = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      name: "Bangladesh Hockey League (BHL)",
      domain: "league1.plaionn.brittosoft.online",
      status: "Active",
      season: "Winter 2026",
      teams: 8,
      commissioner: "commissioner@bhl.com",
    },
    {
      id: "60000000-0000-4000-8000-000000000003",
      name: "Wave Adult Hockey League (WAHL)",
      domain: "league2.plaionn.brittosoft.online",
      status: "Active",
      season: "Winter 2026",
      teams: 12,
      commissioner: "league@wavehockey.ca",
    },
    {
      id: "60000000-0000-4000-8000-000000000004",
      name: "Canada Hockey League (CHL)",
      domain: "league3.plaionn.brittosoft.online",
      status: "Active",
      season: "Winter 2026",
      teams: 16,
      commissioner: "admin@chl.com",
    },
    {
      id: "60000000-0000-4000-8000-000000000005",
      name: "Italy Hockey League (IHL)",
      domain: "league4.plaionn.brittosoft.online",
      status: "Active",
      season: "Winter 2026",
      teams: 6,
      commissioner: "direttore@ihl.com",
    },
  ];

  const roleDefinitions = [
    {
      role: "Super Admin",
      scope: "Global Platform",
      permissions: "Full control over all leagues, domain routing, platform billing, global user deletion, server settings.",
      color: "#ef4444",
    },
    {
      role: "Regular Admin",
      scope: "Global Platform",
      permissions: "Manage all leagues, view platform KPIs, onboard leagues, manage user roles, view financial reports.",
      color: "#f59e0b",
    },
    {
      role: "League Admin / Commissioner",
      scope: "Specific League (e.g. BHL)",
      permissions: "Manage seasons, divisions, schedule generation, arena blackouts, approve rosters, staff management.",
      color: "#10b981",
    },
    {
      role: "Team Admin / Manager",
      scope: "Specific Team",
      permissions: "Submit rosters, assign jersey numbers, verify waivers, pay team fee, designate lines.",
      color: "#3b82f6",
    },
    {
      role: "Player",
      scope: "Individual",
      permissions: "Sign digital liability waiver, pay registration fee, view verified stats, RSVP for games.",
      color: "#8b5cf6",
    },
    {
      role: "Timekeeper",
      scope: "Assigned Games",
      permissions: "Digital rink scorekeeper app, record goals, assists, penalties, line-ups, and three stars.",
      color: "#06b6d4",
    },
    {
      role: "Referee",
      scope: "Assigned Games",
      permissions: "Review official scoresheet, sign-off on finalized game sheet, manage disciplinary penalties.",
      color: "#eab308",
    },
  ];

  return (
    <main id="main" className="public-portal-container" style={{ paddingBottom: "60px" }}>
      {/* 2-Column Admin Shell: Left Navigation Bar + Main Management Body */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Sidebar Menu */}
        <aside
          style={{
            background: "#0c1822",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            padding: "20px 16px",
            position: "sticky",
            top: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ padding: "0 8px 12px 8px", borderBottom: "1px solid var(--line)", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px", textTransform: "uppercase" }}>
              ADMIN NAVIGATION
            </span>
          </div>

          <a
            href="#leagues"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "var(--text)",
              background: "rgba(199, 244, 80, 0.08)",
              border: "1px solid rgba(199, 244, 80, 0.2)",
              textDecoration: "none",
            }}
          >
            <span>🏆</span>
            <span>Leagues</span>
          </a>

          <a
            href="#users"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span>👥</span>
            <span>Users</span>
          </a>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", paddingLeft: "8px" }}>
              Quick Links
            </span>
            <Link
              href="/account"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                fontSize: "12.5px",
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              <span>⚙️</span>
              <span>Account Settings</span>
            </Link>
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                fontSize: "12.5px",
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              <span>↗</span>
              <span>Public Website</span>
            </Link>
          </div>
        </aside>

        {/* Right Main Admin Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Header Banner - Deleted the two crossed out buttons */}
          <section
            style={{
              background: "#0c1921",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "24px 28px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span
                  className="badge"
                  style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontWeight: 800, letterSpacing: "1px" }}
                >
                  CENTRAL MANAGEMENT BACKEND
                </span>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Access: Super Admin &amp; Regular Admin
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: "24px", color: "var(--text)" }}>
                PLAIONN Multi-League Administrator Console
              </h1>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "13.5px", maxWidth: "800px" }}>
                Manage independent sports leagues, configure dedicated domain routing (e.g. bhl.com, chl.com), appoint commissioners, and enforce platform-wide role permissions.
              </p>
            </div>
          </section>

          {/* KPI Metrics Grid */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Active Leagues
              </span>
              <div style={{ fontSize: "30px", fontWeight: 900, color: "var(--lime)", marginTop: "4px" }}>
                4
              </div>
              <small style={{ color: "var(--muted)" }}>BHL, WAHL, CHL, IHL</small>
            </div>

            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Configured Domains
              </span>
              <div style={{ fontSize: "30px", fontWeight: 900, color: "#60a5fa", marginTop: "4px" }}>
                4
              </div>
              <small style={{ color: "var(--muted)" }}>Unique branded websites</small>
            </div>

            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Registered Teams
              </span>
              <div style={{ fontSize: "30px", fontWeight: 900, color: "#f59e0b", marginTop: "4px" }}>
                42
              </div>
              <small style={{ color: "var(--muted)" }}>Across all active divisions</small>
            </div>

            <div className="panel" style={{ padding: "18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Platform Users
              </span>
              <div style={{ fontSize: "30px", fontWeight: 900, color: "#a855f7", marginTop: "4px" }}>
                380+
              </div>
              <small style={{ color: "var(--muted)" }}>Admins, Managers &amp; Players</small>
            </div>
          </section>

          {/* 1. Leagues & Branded Domains */}
          <section id="leagues" className="panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>League Management &amp; Custom Domains</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                  Each league operates as an independent branded public website with unique domain and subdomain routing.
                </p>
              </div>
              <Link href="/account" className="button button-sm primary">
                + Create New League
              </Link>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th>League Name</th>
                    <th>Live Domain</th>
                    <th>Current Season</th>
                    <th>Active Teams</th>
                    <th>Commissioner</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Public Website</th>
                  </tr>
                </thead>
                <tbody>
                  {leaguesList.map((lg) => (
                    <tr key={lg.id}>
                      <td style={{ fontWeight: 800 }}>
                        <Link
                          href={`/admin/league/${lg.id}`}
                          style={{
                            color: "var(--lime)",
                            textDecoration: "underline",
                            textUnderlineOffset: "4px",
                          }}
                          title={`Manage ${lg.name} Backend`}
                        >
                          {lg.name}
                        </Link>
                      </td>
                      <td>
                        <a
                          href={`https://${lg.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <code style={{ background: "rgba(103, 232, 249, 0.1)", border: "1px solid rgba(103, 232, 249, 0.25)", padding: "3px 8px", borderRadius: "4px", color: "#67e8f9", fontSize: "12px" }}>
                            {lg.domain}
                          </code>
                          <span style={{ color: "#67e8f9", fontSize: "11px" }}>↗</span>
                        </a>
                      </td>
                      <td>{lg.season}</td>
                      <td style={{ fontWeight: 700 }}>{lg.teams} teams</td>
                      <td style={{ fontSize: "12.5px", color: "var(--muted)" }}>{lg.commissioner}</td>
                      <td>
                        <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontSize: "10px" }}>
                          {lg.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <a
                          href={`https://${lg.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="button button-sm button-outline"
                          style={{ fontSize: "11.5px", padding: "4px 10px" }}
                          title={`Launch ${lg.name} (${lg.domain})`}
                        >
                          Launch Portal ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Platform Users & User Types (Interactive Management for Super User Shadhin) */}
          <section id="users" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <AdminUsersManager />

            {/* Embedded Roles & Permissions Matrix inside Users Page */}
            <div className="panel" style={{ padding: "24px", marginBottom: 0 }}>
              <div style={{ marginBottom: "18px" }}>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Platform Access Control &amp; Roles Matrix</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                  Central administration enforces strict role separation across the entire ecosystem.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
                {roleDefinitions.map((item) => (
                  <div
                    key={item.role}
                    style={{
                      background: "#0c1822",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "14.5px", color: item.color }}>{item.role}</strong>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(255,255,255,0.08)",
                          color: "var(--muted)",
                        }}
                      >
                        {item.scope}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.4 }}>
                      {item.permissions}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
