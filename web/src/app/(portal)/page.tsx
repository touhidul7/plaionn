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

  const featuredGame = games[0] || null;

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

      {/* Main Bounded Public Portal Container */}
      <main id="main" className="public-portal-container">
        {/* 2. League Game Day Hub & Season Center (Two-Column Balanced Grid) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "24px",
            marginBottom: "36px",
          }}
        >
        {/* Left Card: Featured Game Center */}
        {featuredGame ? (
          <div
            className="panel"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginBottom: 0,
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px", textTransform: "uppercase" }}>
                ● FEATURED MATCHUP · {featuredGame.division_name || "LEAGUE"}
              </span>
              <span className="badge" style={{ fontSize: "10px", padding: "2px 8px" }}>
                {featuredGame.status ? featuredGame.status.toUpperCase() : "SCHEDULED"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#162734",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: "12px",
                      color: "var(--text)",
                    }}
                  >
                    AW
                  </div>
                  <strong style={{ fontSize: "16px", color: "var(--text)" }}>
                    {featuredGame.away_team_name}
                  </strong>
                </div>
                <span style={{ fontSize: "18px", fontWeight: 900, color: "var(--lime)" }}>
                  {typeof featuredGame.away_score === "number" ? featuredGame.away_score : "—"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#162734",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: "12px",
                      color: "var(--text)",
                    }}
                  >
                    HM
                  </div>
                  <strong style={{ fontSize: "16px", color: "var(--text)" }}>
                    {featuredGame.home_team_name}
                  </strong>
                </div>
                <span style={{ fontSize: "18px", fontWeight: 900, color: "var(--lime)" }}>
                  {typeof featuredGame.home_score === "number" ? featuredGame.home_score : "—"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--line)",
                paddingTop: "12px",
                marginTop: "auto",
                fontSize: "12px",
                color: "var(--muted)",
              }}
            >
              <span>
                📍 {featuredGame.venue_name ? `${featuredGame.venue_name} - ${featuredGame.rink_name}` : "Demo Arena"}
              </span>
              <Link
                href={`/schedule/${featuredGame.game_id || featuredGame.id}/live`}
                className="button button-sm primary"
                style={{ fontSize: "11.5px", padding: "6px 14px" }}
              >
                Live Boxscore ↗
              </Link>
            </div>
          </div>
        ) : (
          <div
            className="panel"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginBottom: 0,
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px" }}>
              LEAGUE GAME CENTER
            </span>
            <h3 style={{ margin: 0, fontSize: "18px" }}>Next Matchups</h3>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", flex: 1 }}>
              Official schedule updates and live boxscores will stream here.
            </p>
            <Link href="/schedule" className="button button-sm button-outline">
              View Schedules →
            </Link>
          </div>
        )}

        {/* Right Card: Season & League Quick Hub */}
        <div
          className="panel"
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginBottom: 0,
            background: "#0c1822",
            border: "1px solid var(--line)",
            borderRadius: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", letterSpacing: "1px", textTransform: "uppercase" }}>
              SEASON SELECTOR
            </span>
            {canManage && (
              <Link href="/league" className="text-link" style={{ fontSize: "12px", fontWeight: 700 }}>
                Commissioner HQ ⚙️
              </Link>
            )}
          </div>

          <form action="/" method="get" style={{ display: "flex", gap: "10px", margin: 0 }}>
            <select
              name="season"
              defaultValue={selectedSeason?.id ?? ""}
              style={{
                flex: 1,
                height: "40px",
                background: "#13232e",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                color: "var(--text)",
                padding: "0 12px",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {data.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="button button-sm primary" style={{ height: "40px", padding: "0 18px" }}>
              Switch
            </button>
          </form>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              paddingTop: "6px",
              marginTop: "auto",
            }}
          >
            <div style={{ background: "#111f2a", padding: "12px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>Active Teams</span>
              <strong style={{ fontSize: "18px", color: "var(--lime)" }}>{data.teams.length}</strong>
            </div>
            <div style={{ background: "#111f2a", padding: "12px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>Divisions</span>
              <strong style={{ fontSize: "18px", color: "var(--text)" }}>{data.divisions.length}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Official Division Standings Table */}
      <section style={{ marginBottom: "36px" }}>
        <div className="section-heading" style={{ marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0 }}>
              {selectedSeason ? `${selectedSeason.name} Standings` : "Division Standings"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Official points race, wins, goal differential, and tiebreakers.
            </p>
          </div>
          <Link href="/standings" className="text-link" style={{ fontSize: "13px", fontWeight: 700 }}>
            Full Standings Table →
          </Link>
        </div>

        <section className="panel" style={{ padding: 0, overflow: "hidden", borderRadius: "14px" }}>
          <div className="table-wrap" style={{ margin: 0 }}>
            <table className="table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th className="rank-col">#</th>
                  <th className="team-col">Team</th>
                  <th className="stat-col">GP</th>
                  <th className="stat-col">W</th>
                  <th className="stat-col">L</th>
                  <th className="stat-col">OTL</th>
                  <th className="stat-pts">PTS</th>
                  <th className="stat-col">GF</th>
                  <th className="stat-col">GA</th>
                  <th className="stat-col">DIFF</th>
                </tr>
              </thead>
              <tbody>
                {standingsRows.length > 0 ? (
                  standingsRows.map((row, idx) => {
                    const initials = (row.team_name || "TM")
                      .split(/\s+/)
                      .map((w: string) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 3);

                    return (
                      <tr key={row.team_entry_id || idx}>
                        <td className="rank-col">{idx + 1}</td>
                        <td className="team-col">
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "6px",
                                background: "#162734",
                                border: "1px solid var(--line)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10.5px",
                                fontWeight: 800,
                                color: "var(--lime)",
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </span>
                            <Link
                              href={`/teams/${row.team_entry_id}`}
                              className="text-link"
                              style={{ color: "var(--text)", fontSize: "14px", fontWeight: 700 }}
                            >
                              {row.team_name}
                            </Link>
                          </div>
                        </td>
                        <td className="stat-col">{row.games_played}</td>
                        <td className="stat-col">{row.wins}</td>
                        <td className="stat-col">{row.losses}</td>
                        <td className="stat-col">{row.ot_losses}</td>
                        <td className="stat-pts">{row.points}</td>
                        <td className="stat-col">{row.goals_for}</td>
                        <td className="stat-col">{row.goals_against}</td>
                        <td
                          className="stat-col"
                          style={{
                            fontWeight: 700,
                            color:
                              row.goal_difference > 0
                                ? "var(--lime)"
                                : row.goal_difference < 0
                                ? "#f87171"
                                : "inherit",
                          }}
                        >
                          {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  data.teams.map((t, idx) => {
                    const initials = t.name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 3);

                    return (
                      <tr key={t.entry_id}>
                        <td className="rank-col">{idx + 1}</td>
                        <td className="team-col">
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "6px",
                                background: "#162734",
                                border: "1px solid var(--line)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "10.5px",
                                fontWeight: 800,
                                color: "var(--lime)",
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </span>
                            <Link href={`/teams/${t.entry_id}`} className="text-link" style={{ fontWeight: 700 }}>
                              {t.name}
                            </Link>
                          </div>
                        </td>
                        <td className="stat-col">0</td>
                        <td className="stat-col">0</td>
                        <td className="stat-col">0</td>
                        <td className="stat-col">0</td>
                        <td className="stat-pts">0</td>
                        <td className="stat-col">0</td>
                        <td className="stat-col">0</td>
                        <td className="stat-col">0</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* 4. Active Member Clubs Showcase */}
      <section style={{ marginBottom: "36px" }}>
        <div className="section-heading" style={{ marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0 }}>League Member Clubs</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Explore active team profiles, rosters, and schedules.
            </p>
          </div>
          <Link href="/teams" className="text-link" style={{ fontSize: "13px", fontWeight: 700 }}>
            All Teams Directory →
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          {data.teams.map((t) => {
            const initials = t.name
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 3);

            return (
              <div
                key={t.entry_id}
                className="panel"
                style={{
                  padding: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                  marginBottom: 0,
                  background: "#0c1822",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: "#162734",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: "15px",
                      color: "var(--lime)",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>{t.name}</h3>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {t.division_name} · {t.season_name}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/teams/${t.entry_id}`}
                  className="button button-sm button-outline"
                  style={{ fontSize: "11.5px", padding: "6px 12px", flexShrink: 0 }}
                >
                  Roster →
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Quick Portal Navigation Cards */}
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
    </main>
    </>
  );
}
