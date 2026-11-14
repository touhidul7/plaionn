import Link from "next/link";
import { getVerifiedSession } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

interface DashboardData {
  has_profile: boolean;
  player_id?: string;
  display_name?: string;
  teams: Array<{
    team_id: string;
    team_name: string;
    team_entry_id: string;
    division_name: string;
    season_name: string;
    league_name: string;
    league_id: string;
    jersey_number?: number;
    position: string;
    status: string;
  }>;
  upcoming_games: Array<{
    game_id: string;
    starts_at: string;
    status: string;
    my_team_name: string;
    opponent_team_name: string;
    is_home: boolean;
    venue_name: string;
    rink_name: string;
    my_rsvp: string;
    rsvp_note: string;
  }>;
  career_stats: {
    goals: number;
    assists: number;
    points: number;
    pim: number;
    games_played: number;
  };
  invoices: Array<{
    id: string;
    title: string;
    recipient_type: string;
    amount_cents: number;
    amount_paid_cents: number;
    balance_cents: number;
    currency: string;
    due_date?: string;
    status: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    version: number;
    signer_name: string;
    accepted_at: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    created_at: string;
  }>;
}

export default async function PlayerDashboardPage() {
  const { supabase, user } = await getVerifiedSession();

  const { data: rawDashboard, error } = await supabase.rpc(
    "get_player_portal_dashboard"
  );

  const dashboard: DashboardData = rawDashboard ?? {
    has_profile: false,
    teams: [],
    upcoming_games: [],
    career_stats: { goals: 0, assists: 0, points: 0, pim: 0, games_played: 0 },
    invoices: [],
    documents: [],
    announcements: [],
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAYER HUB</p>
          <h1>{dashboard.has_profile ? `Welcome back, ${dashboard.display_name}` : "Player Dashboard"}</h1>
          <p>{user.email}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link className="button" href="/schedule">
            View Schedule
          </Link>
          <Link className="button" href="/standings">
            League Standings
          </Link>
          <Link className="button" href="/registration">
            Apply for Season
          </Link>
        </div>
      </div>

      {/* Announcements */}
      {dashboard.announcements.length > 0 && (
        <section
          className="panel"
          style={{
            borderLeft: "4px solid #3b82f6",
            background: "var(--panel-bg, #ffffff)",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>📢 League Announcements</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {dashboard.announcements.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--border-color, #eee)", paddingBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong>{a.title}</strong>
                  {a.priority !== "normal" && (
                    <span className="badge" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>
                      {a.priority}
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: "var(--text-muted, #555)" }}>
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Career Stats Grid */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <h2>Personal Career &amp; Season Performance</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <div style={{ background: "var(--subtle-bg, #f8fafc)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>GAMES PLAYED</span>
            <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0" }}>
              {dashboard.career_stats.games_played}
            </p>
          </div>
          <div style={{ background: "var(--subtle-bg, #f8fafc)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>GOALS</span>
            <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#16a34a" }}>
              {dashboard.career_stats.goals}
            </p>
          </div>
          <div style={{ background: "var(--subtle-bg, #f8fafc)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>ASSISTS</span>
            <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#2563eb" }}>
              {dashboard.career_stats.assists}
            </p>
          </div>
          <div style={{ background: "var(--subtle-bg, #f8fafc)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>TOTAL POINTS</span>
            <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#9333ea" }}>
              {dashboard.career_stats.points}
            </p>
          </div>
          <div style={{ background: "var(--subtle-bg, #f8fafc)", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>PENALTY MIN (PIM)</span>
            <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#d97706" }}>
              {dashboard.career_stats.pim}
            </p>
          </div>
        </div>
      </section>

      {/* Upcoming Matches & Quick RSVP */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Next Scheduled Matchups</h2>
          <Link className="text-link" href="/schedule">
            Full Schedule →
          </Link>
        </div>

        {dashboard.upcoming_games.length === 0 ? (
          <p className="hint">No upcoming games scheduled in the immediate horizon.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {dashboard.upcoming_games.map((g) => (
              <div
                key={g.game_id}
                style={{
                  border: "1px solid var(--border-color, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: "var(--card-bg, #ffffff)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                    <span>{new Date(g.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span>{new Date(g.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <strong style={{ fontSize: "1.05rem", display: "block" }}>
                    {g.my_team_name} {g.is_home ? "vs" : "@"} {g.opponent_team_name}
                  </strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", margin: "4px 0 8px 0" }}>
                    📍 {g.venue_name} · {g.rink_name}
                  </p>
                </div>
                <div style={{ marginTop: "1rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>RSVP: </span>
                    <span
                      className="badge"
                      style={{
                        fontSize: "0.75rem",
                        background:
                          g.my_rsvp === "attending"
                            ? "#dcfce7"
                            : g.my_rsvp === "out"
                            ? "#fee2e2"
                            : "#fef9c3",
                        color:
                          g.my_rsvp === "attending"
                            ? "#15803d"
                            : g.my_rsvp === "out"
                            ? "#b91c1c"
                            : "#854d0e",
                      }}
                    >
                      {g.my_rsvp.toUpperCase()}
                    </span>
                  </div>
                  <Link className="button" style={{ fontSize: "0.8rem", padding: "4px 8px" }} href={`/schedule/${g.game_id}/rsvp`}>
                    Update RSVP →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Teams & Rosters */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <h2>My Teams &amp; Division Rosters</h2>
        {dashboard.teams.length === 0 ? (
          <div className="empty">
            <p>You are not currently rostered on an active team.</p>
            <Link className="button" href="/registration">
              Register for an upcoming season
            </Link>
          </div>
        ) : (
          <table className="table" style={{ width: "100%", textAlign: "left", marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>Team</th>
                <th>League</th>
                <th>Division / Season</th>
                <th>Jersey #</th>
                <th>Position</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.teams.map((t) => (
                <tr key={t.team_entry_id}>
                  <td>
                    <strong>{t.team_name}</strong>
                  </td>
                  <td>{t.league_name}</td>
                  <td>{t.division_name} ({t.season_name})</td>
                  <td>{t.jersey_number ?? "—"}</td>
                  <td>
                    <span className="badge">{t.position}</span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: t.status === "active" ? "#dcfce7" : "#f1f5f9",
                        color: t.status === "active" ? "#166534" : "#475569",
                      }}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <Link className="text-link" href={`/teams/${t.team_entry_id}`}>
                      Team Hub →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Invoices & Balances */}
      <section className="panel" style={{ marginBottom: "1.5rem" }}>
        <h2>League Dues &amp; Invoices</h2>
        {dashboard.invoices.length === 0 ? (
          <p className="hint">No outstanding or past due invoices found for your accounts.</p>
        ) : (
          <table className="table" style={{ width: "100%", textAlign: "left", marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Type</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>{inv.title}</strong></td>
                  <td><span className="badge">{inv.recipient_type}</span></td>
                  <td>{(inv.amount_cents / 100).toFixed(2)} {inv.currency}</td>
                  <td>{(inv.amount_paid_cents / 100).toFixed(2)} {inv.currency}</td>
                  <td style={{ fontWeight: inv.balance_cents > 0 ? "bold" : "normal", color: inv.balance_cents > 0 ? "#dc2626" : "inherit" }}>
                    {(inv.balance_cents / 100).toFixed(2)} {inv.currency}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: inv.status === "paid" ? "#dcfce7" : "#fee2e2",
                        color: inv.status === "paid" ? "#166534" : "#b91c1c",
                      }}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Signed Documents & Waivers */}
      <section className="panel">
        <h2>Signed Waivers &amp; Documentation</h2>
        {dashboard.documents.length === 0 ? (
          <p className="hint">No signed documents currently on file.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
            {dashboard.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  border: "1px solid var(--border-color, #e2e8f0)",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  background: "var(--subtle-bg, #f8fafc)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>📄 {doc.title}</strong>
                  <span className="badge" style={{ fontSize: "0.7rem" }}>v{doc.version}</span>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Signed by {doc.signer_name} on {new Date(doc.accepted_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
