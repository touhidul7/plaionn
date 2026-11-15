import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function AdminManagementPage() {
  const { user, canManage } = await getLeagueContext();

  const leaguesList = [
    {
      id: "60000000-0000-4000-8000-000000000002",
      name: "Bangladesh Hockey League (BHL)",
      domain: "bhl.com",
      status: "Active",
      season: "Winter 2026",
      teams: 8,
      commissioner: "commissioner@bhl.com",
    },
    {
      id: "60000000-0000-4000-8000-000000000001",
      name: "Wave Adult Hockey League (WAHL)",
      domain: "waveadulthockeyleague.ca",
      status: "Active",
      season: "Winter 2026",
      teams: 12,
      commissioner: "league@wavehockey.ca",
    },
    {
      id: "60000000-0000-4000-8000-000000000003",
      name: "Canada Hockey League (CHL)",
      domain: "chl.com",
      status: "Active",
      season: "Winter 2026",
      teams: 16,
      commissioner: "admin@chl.com",
    },
    {
      id: "60000000-0000-4000-8000-000000000004",
      name: "Italy Hockey League (IHL)",
      domain: "ihl.com",
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
      permissions: "Sign digital waiver via GoHighLevel, pay registration fee, view verified stats, RSVP for games.",
      color: "#8b5cf6",
    },
    {
      role: "Timekeeper / Scorekeeper",
      scope: "Assigned Games",
      permissions: "Digital rink scorekeeper app, record goals, assists, penalties, line-ups, and three stars.",
      color: "#06b6d4",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Super Admin Top Header */}
      <section
        style={{
          background: "#0c1921",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "24px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
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
          <h1 style={{ margin: 0, fontSize: "26px", color: "var(--text)" }}>
            PLAIONN Multi-League Administrator Console
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "14px", maxWidth: "800px" }}>
            Manage independent sports leagues, configure dedicated domain routing (e.g. bhl.com, chl.com), appoint commissioners, and enforce platform-wide role permissions.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/plaionn" className="button button-outline" style={{ fontSize: "13px" }}>
            Plaionn Public Site (plaionn.com) ↗
          </Link>
          <Link href="/" className="button primary" style={{ fontSize: "13px" }}>
            View Current League Portal →
          </Link>
        </div>
      </section>

      {/* KPI Overview Metrics */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div className="panel" style={{ padding: "20px", marginBottom: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Active Leagues
          </span>
          <div style={{ fontSize: "32px", fontWeight: 900, color: "var(--lime)", marginTop: "4px" }}>
            4
          </div>
          <small style={{ color: "var(--muted)" }}>BHL, WAHL, CHL, IHL</small>
        </div>

        <div className="panel" style={{ padding: "20px", marginBottom: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Configured Domains
          </span>
          <div style={{ fontSize: "32px", fontWeight: 900, color: "#60a5fa", marginTop: "4px" }}>
            4
          </div>
          <small style={{ color: "var(--muted)" }}>Unique branded websites</small>
        </div>

        <div className="panel" style={{ padding: "20px", marginBottom: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Registered Teams
          </span>
          <div style={{ fontSize: "32px", fontWeight: 900, color: "#f59e0b", marginTop: "4px" }}>
            42
          </div>
          <small style={{ color: "var(--muted)" }}>Across all active divisions</small>
        </div>

        <div className="panel" style={{ padding: "20px", marginBottom: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Verified Players
          </span>
          <div style={{ fontSize: "32px", fontWeight: 900, color: "#a855f7", marginTop: "4px" }}>
            380+
          </div>
          <small style={{ color: "var(--muted)" }}>Waiver cleared via GHL</small>
        </div>
      </section>

      {/* Multi-League & Unique Domain Management */}
      <section className="panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px" }}>League Management &amp; Custom Domains</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Each league operates as an independent branded public website with unique domain routing.
            </p>
          </div>
          <button
            type="button"
            className="button button-sm primary"
            onClick={() => alert("League creation dialog: Enter League Name, Custom Domain (e.g. bhl.com), and Commissioner Email.")}
          >
            + Create New League
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th>League Name</th>
                <th>Branded Domain</th>
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
                  <td style={{ fontWeight: 800, color: "var(--text)" }}>{lg.name}</td>
                  <td>
                    <code style={{ background: "#172b38", padding: "2px 8px", borderRadius: "4px", color: "#67e8f9" }}>
                      {lg.domain}
                    </code>
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
                    <Link
                      href="/"
                      className="button button-sm button-outline"
                      style={{ fontSize: "11.5px", padding: "4px 10px" }}
                      title={`Visit ${lg.domain} Public Portal`}
                    >
                      Launch Portal ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* User Roles & Permissions Matrix */}
      <section className="panel" style={{ padding: "24px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Platform Access Control &amp; Roles Matrix</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Central administration enforces strict role separation across the entire ecosystem.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
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
                <strong style={{ fontSize: "15px", color: item.color }}>{item.role}</strong>
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
      </section>
    </div>
  );
}
