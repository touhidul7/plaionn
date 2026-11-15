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

  // Fetch recent/upcoming games for this season
  const { data: rawGames } = await supabase
    .from("games")
    .select("id, starts_at, status, home_entry_id, away_entry_id, rink_id")
    .eq("league_id", data.league.id)
    .order("starts_at", { ascending: true })
    .limit(6);

  const games = rawGames || [];

  // Fetch standings for selected season
  let standingsRows: any[] = [];
  if (selectedSeason) {
    const { data: standingsData } = await supabase.rpc("get_season_standings", {
      target_season: selectedSeason.id,
    });
    if (standingsData && Array.isArray(standingsData)) {
      standingsRows = standingsData.slice(0, 8);
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
      {/* 1. Plaionn Full-Width Public Hero Banner (Dark Slate & Lime) */}
      <section className="plaionn-hero">
        <h1 className="plaionn-hero-title">
          — WELCOME TO {data.league.name.toUpperCase()} —
        </h1>
        <Link className="plaionn-hero-btn" href="/teams">
          Team Pages
        </Link>
      </section>

      {/* 2. Season Selector Bar (Current & Past Seasons Dropdown) */}
      <section className="panel" style={{ marginBottom: "28px", padding: "16px 24px" }}>
        <form
          action="/"
          method="get"
          className="filter-bar"
          style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", margin: 0 }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: 0,
              fontWeight: 700,
              fontSize: "13.5px",
            }}
          >
            <span>Current &amp; Past Seasons:</span>
            <select
              name="season"
              defaultValue={selectedSeason?.id ?? ""}
              style={{ minWidth: "220px", height: "40px" }}
            >
              {data.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button button-sm primary">
            View Season Records
          </button>

          {canManage && (
            <div style={{ marginLeft: "auto" }}>
              <Link href="/league" className="text-link" style={{ fontSize: "12.5px" }}>
                ⚙️ Commissioner League HQ →
              </Link>
            </div>
          )}
        </form>
      </section>

      {/* 3. Featured Games & Matchups */}
      <div className="section-heading">
        <h2>Featured Matchups &amp; Upcoming Games</h2>
        <Link href="/schedule" className="text-link">
          Full Schedule &amp; Scores →
        </Link>
      </div>

      {games.length === 0 ? (
        <section className="panel empty" style={{ marginBottom: "28px" }}>
          <p>No games currently scheduled for this season. Check back soon for opening day.</p>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {games.map((g) => {
            const home =
              data.teams.find((t) => t.entry_id === g.home_entry_id)?.name ?? "Home Team";
            const away =
              data.teams.find((t) => t.entry_id === g.away_entry_id)?.name ?? "Away Team";
            const isCompleted = g.status === "completed";

            return (
              <div
                key={g.id}
                className="panel"
                style={{
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--muted)",
                  }}
                >
                  <span>
                    {new Date(g.starts_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span
                    className={`badge ${isCompleted ? "primary" : ""}`}
                    style={{ fontSize: "10px", padding: "2px 8px" }}
                  >
                    {isCompleted ? "FINAL" : "SCHEDULED"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    <span>{away}</span>
                    <span style={{ color: "var(--muted)" }}>—</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    <span>{home}</span>
                    <span style={{ color: "var(--muted)" }}>—</span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: "10px",
                    marginTop: "auto",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Official League Game</span>
                  <Link
                    href={`/schedule/${g.id}/live`}
                    className="text-link"
                    style={{ fontSize: "12px", fontWeight: 700 }}
                  >
                    Game Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Division Standings Preview (with Clickable Teams) */}
      <div className="section-heading">
        <h2>
          {selectedSeason ? `${selectedSeason.name} Standings Snapshot` : "Division Standings"}
        </h2>
        <Link href="/standings" className="text-link">
          Complete Standings Table →
        </Link>
      </div>

      {standingsRows.length === 0 ? (
        <section className="panel empty" style={{ marginBottom: "32px" }}>
          <p>Standings will calculate automatically once league games commence.</p>
        </section>
      ) : (
        <section className="panel" style={{ marginBottom: "32px", overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>Team</th>
                <th style={{ textAlign: "center" }}>GP</th>
                <th style={{ textAlign: "center" }}>W</th>
                <th style={{ textAlign: "center" }}>L</th>
                <th style={{ textAlign: "center" }}>OTL</th>
                <th style={{ textAlign: "center", fontWeight: 800 }}>PTS</th>
                <th style={{ textAlign: "center" }}>GF</th>
                <th style={{ textAlign: "center" }}>GA</th>
                <th style={{ textAlign: "center" }}>DIFF</th>
              </tr>
            </thead>
            <tbody>
              {standingsRows.map((row, idx) => (
                <tr key={row.team_entry_id || idx}>
                  <td style={{ fontWeight: 700, color: "var(--muted)" }}>{idx + 1}</td>
                  <td style={{ fontWeight: 700 }}>
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

      {/* 5. Announcements / League Notices */}
      {announcements && announcements.length > 0 && (
        <section style={{ marginBottom: "32px" }}>
          <div className="section-heading">
            <h2>League Bulletins &amp; Notices</h2>
            <Link href="/announcements" className="text-link">
              All Announcements →
            </Link>
          </div>
          <div style={{ display: "grid", gap: "12px" }}>
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="panel"
                style={{
                  padding: "18px 24px",
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
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "13.5px" }}>
                  {ann.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Quick Access Action Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          marginBottom: "36px",
        }}
      >
        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Player Registration</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", flex: 1 }}>
            Sign digital waivers with GoHighLevel CRM sync and choose individual or team payment.
          </p>
          <Link href="/registration" className="button button-sm primary">
            Register Player ↗
          </Link>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Skater &amp; Goalie Stats</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", flex: 1 }}>
            Individual player scoring race, goals, assists, goaltender save percentage, and GAA.
          </p>
          <Link href="/leaders" className="button button-sm">
            View Leaders ↗
          </Link>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Playoffs &amp; Tournaments</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", flex: 1 }}>
            Follow championship brackets, series boxscores, and playoff seeds.
          </p>
          <Link href="/playoffs" className="button button-sm">
            Championship Brackets ↗
          </Link>
        </div>
      </section>
    </>
  );
}
