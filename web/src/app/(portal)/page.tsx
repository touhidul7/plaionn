import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: requestedSeason } = await searchParams;
  const data = await getLeagueData();
  const { supabase, canManage } = await getLeagueContext();

  const selectedSeason =
    data.seasons.find((s) => s.id === requestedSeason) ?? data.seasons[0];

  // Fetch games for this season using public schedule RPC (security definer)
  let games: any[] = [];
  try {
    const { data: publicSchedule } = await supabase.rpc("get_public_schedule", {
      target_league: data.league.id,
    });
    if (publicSchedule && Array.isArray(publicSchedule)) {
      games = publicSchedule.slice(0, 6);
    }
  } catch {
    // Fallback
  }

  // Fetch standings for selected season
  let standingsRows: any[] = [];
  if (selectedSeason) {
    try {
      const { data: standingsData } = await supabase.rpc("get_season_standings", {
        target_season: selectedSeason.id,
      });
      if (standingsData && Array.isArray(standingsData)) {
        standingsRows = standingsData.slice(0, 8);
      }
    } catch {
      // Standings fallback
    }
  }

  // Fetch published announcements
  const { data: announcements } = await supabase
    .from("league_announcements")
    .select("id, title, message, priority, published_at")
    .eq("league_id", data.league.id)
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <>
      {/* 1. Cinematic Photographic Arena Hero */}
      <section className="plaionn-hero">
        <div className="plaionn-hero-badge">
          <span className="dot" />
          <span>OFFICIAL HOCKEY LEAGUE · 2026 SEASON</span>
        </div>

        <h1 className="plaionn-hero-title">
          WELCOME TO {data.league.name.toUpperCase()}
        </h1>

        <p className="plaionn-hero-sub">
          Official home for live game schedules, scores, division standings, verified team rosters, and real-time game center tracking.
        </p>

        <div className="plaionn-hero-actions">
          <Link className="plaionn-hero-btn" href="/teams">
            Team Pages →
          </Link>
          <Link className="plaionn-hero-btn-secondary" href="/schedule">
            Schedule &amp; Scores
          </Link>
          <Link className="plaionn-hero-btn-secondary" href="/standings">
            Standings Table
          </Link>
        </div>
      </section>

      {/* 2. Season Selector & League Metrics Strip */}
      <section
        style={{
          background: "#0d1a22",
          border: "1px solid var(--line)",
          borderRadius: "14px",
          padding: "18px 24px",
          marginBottom: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <form
          action="/"
          method="get"
          style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", margin: 0 }}
        >
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
            Season:
          </span>
          <select
            name="season"
            defaultValue={selectedSeason?.id ?? ""}
            style={{
              minWidth: "220px",
              height: "38px",
              background: "#13232e",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              color: "var(--text)",
              padding: "0 12px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {data.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="button button-sm primary"
            style={{ height: "38px", padding: "0 18px", fontSize: "12.5px" }}
          >
            Apply Filter
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12.5px", color: "var(--muted)" }}>
          <div>
            <strong style={{ color: "var(--text)" }}>{data.teams.length}</strong> Teams Registered
          </div>
          <span style={{ opacity: 0.3 }}>|</span>
          <div>
            <strong style={{ color: "var(--text)" }}>{data.divisions.length}</strong> Divisions
          </div>
          {canManage && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <Link href="/league" className="text-link" style={{ fontSize: "12.5px", fontWeight: 700 }}>
                Commissioner HQ ⚙️
              </Link>
            </>
          )}
        </div>
      </section>

      {/* 3. Featured Matchups & Upcoming Games (Bounded Card Grid) */}
      <div className="section-heading" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", margin: 0 }}>Featured Matchups &amp; Upcoming Games</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Official game center with real-time boxscores and schedule tracking.
          </p>
        </div>
        <Link href="/schedule" className="text-link" style={{ fontSize: "13px", fontWeight: 700 }}>
          Full Schedule &amp; Scores →
        </Link>
      </div>

      {games.length === 0 ? (
        <section className="panel empty" style={{ marginBottom: "32px", padding: "36px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
            No upcoming games scheduled for this season. Check back soon for opening day.
          </p>
        </section>
      ) : (
        <div className="matchups-grid">
          {games.map((g) => {
            const isCompleted = g.status === "completed" || g.status === "final";
            const isLive = g.status === "in_progress" || g.status === "live";

            return (
              <div key={g.game_id || g.id} className="matchup-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                  <span style={{ color: "var(--lime)", fontWeight: 800, textTransform: "uppercase" }}>
                    {new Date(g.starts_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    @{" "}
                    {new Date(g.starts_at).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`badge ${isLive ? "primary" : isCompleted ? "primary" : ""}`}
                    style={{ fontSize: "10px", padding: "2px 8px" }}
                  >
                    {isLive ? "LIVE" : isCompleted ? "FINAL" : "SCHEDULED"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: "15px", color: "var(--text)" }}>
                      {g.away_team_name}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: "16px", color: "var(--lime)" }}>
                      {typeof g.away_score === "number" ? g.away_score : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontSize: "15px", color: "var(--text)" }}>
                      {g.home_team_name}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: "16px", color: "var(--lime)" }}>
                      {typeof g.home_score === "number" ? g.home_score : "—"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: "12px",
                    marginTop: "auto",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                    📍 {g.venue_name ? `${g.venue_name} - ${g.rink_name ?? "Main"}` : "Arena Rink"}
                  </span>
                  <Link
                    href={`/schedule/${g.game_id || g.id}/live`}
                    className="button button-sm button-outline"
                    style={{ fontSize: "11.5px", padding: "4px 10px" }}
                  >
                    Game Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Division Standings Snapshot */}
      <div className="section-heading" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", margin: 0 }}>
            {selectedSeason ? `${selectedSeason.name} Standings` : "Division Standings"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Current points and division race tiebreakers.
          </p>
        </div>
        <Link href="/standings" className="text-link" style={{ fontSize: "13px", fontWeight: 700 }}>
          Complete Standings Table →
        </Link>
      </div>

      {standingsRows.length === 0 ? (
        <section className="panel empty" style={{ marginBottom: "32px", padding: "36px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
            Standings will calculate automatically once official league games are completed.
          </p>
        </section>
      ) : (
        <section className="panel" style={{ marginBottom: "36px", overflowX: "auto", padding: 0 }}>
          <table className="table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>Team</th>
                <th style={{ textAlign: "center" }}>GP</th>
                <th style={{ textAlign: "center" }}>W</th>
                <th style={{ textAlign: "center" }}>L</th>
                <th style={{ textAlign: "center" }}>OTL</th>
                <th style={{ textAlign: "center", fontWeight: 800, color: "var(--lime)" }}>PTS</th>
                <th style={{ textAlign: "center" }}>GF</th>
                <th style={{ textAlign: "center" }}>GA</th>
                <th style={{ textAlign: "center" }}>DIFF</th>
              </tr>
            </thead>
            <tbody>
              {standingsRows.map((row, idx) => (
                <tr key={row.team_entry_id || idx}>
                  <td style={{ fontWeight: 700, color: "var(--muted)" }}>{idx + 1}</td>
                  <td style={{ fontWeight: 800 }}>
                    <Link
                      href={`/teams/${row.team_entry_id}`}
                      className="text-link"
                      style={{ color: "var(--text)" }}
                    >
                      {row.team_name}
                    </Link>
                  </td>
                  <td style={{ textAlign: "center" }}>{row.games_played}</td>
                  <td style={{ textAlign: "center" }}>{row.wins}</td>
                  <td style={{ textAlign: "center" }}>{row.losses}</td>
                  <td style={{ textAlign: "center" }}>{row.ot_losses}</td>
                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: 800,
                      color: "var(--lime)",
                      fontSize: "15px",
                    }}
                  >
                    {row.points}
                  </td>
                  <td style={{ textAlign: "center" }}>{row.goals_for}</td>
                  <td style={{ textAlign: "center" }}>{row.goals_against}</td>
                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: 600,
                      color:
                        row.goal_differential > 0
                          ? "var(--lime)"
                          : row.goal_differential < 0
                          ? "#f87171"
                          : "inherit",
                    }}
                  >
                    {row.goal_differential > 0 ? `+${row.goal_differential}` : row.goal_differential}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 5. League Notices & Bulletins */}
      {announcements && announcements.length > 0 && (
        <section style={{ marginBottom: "36px" }}>
          <div className="section-heading" style={{ marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "20px", margin: 0 }}>League Bulletins &amp; Notices</h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                Official communication from league administration.
              </p>
            </div>
            <Link href="/announcements" className="text-link" style={{ fontSize: "13px", fontWeight: 700 }}>
              All Announcements →
            </Link>
          </div>
          <div style={{ display: "grid", gap: "12px" }}>
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="panel"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginBottom: 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "16px" }}>{ann.title}</h3>
                  <small style={{ color: "var(--muted)", fontSize: "11.5px" }}>
                    {new Date(ann.published_at).toLocaleDateString()}
                  </small>
                </div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "13.5px", lineHeight: 1.5 }}>
                  {ann.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Quick Portal Action Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          marginBottom: "36px",
        }}
      >
        <div className="panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px", marginBottom: 0 }}>
          <div style={{ fontSize: "28px" }}>✍</div>
          <h3 style={{ margin: 0, fontSize: "17px" }}>Player Registration</h3>
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>
            Sign digital waivers with GoHighLevel CRM sync and choose individual or team payment options.
          </p>
          <Link href="/registration" className="button button-sm primary">
            Register Player ↗
          </Link>
        </div>

        <div className="panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px", marginBottom: 0 }}>
          <div style={{ fontSize: "28px" }}>🎯</div>
          <h3 style={{ margin: 0, fontSize: "17px" }}>Stats &amp; Scoring Race</h3>
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>
            Follow the skater scoring race, goals, assists, goaltender save percentage, and GAA leaderboards.
          </p>
          <Link href="/leaders" className="button button-sm button-outline">
            View Leaders ↗
          </Link>
        </div>

        <div className="panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px", marginBottom: 0 }}>
          <div style={{ fontSize: "28px" }}>🏆</div>
          <h3 style={{ margin: 0, fontSize: "17px" }}>Playoffs &amp; Championship</h3>
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", flex: 1, lineHeight: 1.5 }}>
            View championship playoff brackets, series matchups, elimination schedules, and past champions.
          </p>
          <Link href="/playoffs" className="button button-sm button-outline">
            Championship Brackets ↗
          </Link>
        </div>
      </section>
    </>
  );
}
