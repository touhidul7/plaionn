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

  const { data: rawDashboard } = await supabase.rpc(
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
            borderLeft: "4px solid var(--lime)",
            background: "var(--panel)",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>📢 League Announcements</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {dashboard.announcements.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong>{a.title}</strong>
                  {a.priority !== "standard" && (
                    <span className="badge" style={{ fontSize: "0.7rem", textTransform: "uppercase" }}>
                      {a.priority}
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: "var(--muted)" }}>
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
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              padding: "1.2rem 1rem",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.5px" }}>
              GAMES PLAYED
            </span>
            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "4px 0 0 0", color: "var(--text)" }}>
              {dashboard.career_stats.games_played}
            </p>
          </div>
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              padding: "1.2rem 1rem",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.5px" }}>
              GOALS
            </span>
            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "4px 0 0 0", color: "var(--lime)" }}>
              {dashboard.career_stats.goals}
            </p>
          </div>
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              padding: "1.2rem 1rem",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.5px" }}>
              ASSISTS
            </span>
            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#66d6e9" }}>
              {dashboard.career_stats.assists}
            </p>
          </div>
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              padding: "1.2rem 1rem",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.5px" }}>
              TOTAL POINTS
            </span>
            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#ffffff" }}>
              {dashboard.career_stats.points}
            </p>
          </div>
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              padding: "1.2rem 1rem",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.5px" }}>
              PENALTY MIN (PIM)
            </span>
            <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#f59e0b" }}>
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
          <p style={{ color: "var(--muted)" }}>No upcoming games scheduled in the immediate horizon.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {dashboard.upcoming_games.map((g) => (
              <div
                key={g.game_id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "1.2rem",
                  background: "#0c1822",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                    <span>{new Date(g.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span>{new Date(g.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <strong style={{ fontSize: "1.05rem", display: "block", color: "var(--text)" }}>
                    {g.my_team_name} {g.is_home ? "vs" : "@"} {g.opponent_team_name}
                  </strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "4px 0 8px 0" }}>
                    📍 {g.venue_name} · {g.rink_name}
                  </p>
                </div>
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>RSVP: </span>
                    <span
                      className="badge"
                      style={{
                        fontSize: "0.75rem",
                        background:
                          g.my_rsvp === "attending"
                            ? "#1e3a2b"
                            : g.my_rsvp === "out"
                            ? "#3a1e1e"
                            : "#3a321e",
                        color:
                          g.my_rsvp === "attending"
                            ? "var(--lime)"
                            : g.my_rsvp === "out"
                            ? "#fca5a5"
                            : "#fde047",
                        border:
                          g.my_rsvp === "attending"
                            ? "1px solid #2e593f"
                            : g.my_rsvp === "out"
                            ? "1px solid #7f1d1d"
                            : "1px solid #713f12",
                      }}
                    >
                      {g.my_rsvp.toUpperCase()}
                    </span>
                  </div>
                  <Link className="button" style={{ fontSize: "0.8rem", padding: "5px 10px" }} href={`/schedule/${g.game_id}/rsvp`}>
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
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>You are not currently rostered on an active team.</p>
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
                        background: t.status === "active" ? "#1e3a2b" : "#1a2e38",
                        color: t.status === "active" ? "var(--lime)" : "var(--muted)",
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
          <p style={{ color: "var(--muted)" }}>No outstanding or past due invoices found for your accounts.</p>
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
                  <td style={{ fontWeight: inv.balance_cents > 0 ? "bold" : "normal", color: inv.balance_cents > 0 ? "#f87171" : "inherit" }}>
                    {(inv.balance_cents / 100).toFixed(2)} {inv.currency}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: inv.status === "paid" ? "#1e3a2b" : "#3a1e1e",
                        color: inv.status === "paid" ? "var(--lime)" : "#fca5a5",
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
          <p style={{ color: "var(--muted)" }}>No signed documents currently on file.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
            {dashboard.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "0.85rem 1.1rem",
                  background: "#0c1822",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>📄 {doc.title}</strong>
                  <span className="badge" style={{ fontSize: "0.7rem" }}>v{doc.version}</span>
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
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
