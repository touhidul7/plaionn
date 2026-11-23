import Link from "next/link";
import { z } from "zod";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { getUnifiedLeagueStandings } from "@/lib/league-standings";

export const dynamic = "force-dynamic";

const standingsRowSchema = z.object({
  division_id: z.uuid(),
  division_name: z.string(),
  team_entry_id: z.uuid(),
  team_name: z.string(),
  rank: z.number(),
  games_played: z.number(),
  wins: z.number(),
  ties: z.number(),
  losses: z.number(),
  overtime_losses: z.number(),
  goals_for: z.number(),
  goals_against: z.number(),
  goal_difference: z.number(),
  penalty_minutes: z.number(),
  points: z.number(),
  head_to_head_points: z.number(),
});

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ season: requestedSeason }, data] = await Promise.all([
    searchParams,
    getLeagueData(),
  ]);
  const selectedSeason =
    data.seasons.find((season) => season.id === requestedSeason) ??
    data.seasons[0];

  if (!selectedSeason)
    return (
      <main id="main" className="public-portal-container">
        <div className="page-heading">
          <div>
            <p className="eyebrow">OFFICIAL TABLE</p>
            <h1>Standings</h1>
            <p>{data.league.name}</p>
          </div>
          <Link
            className="button"
            href={data.user ? "/league" : "/schedule"}
          >
            {data.user ? "League setup" : "Schedules & Scores"}
          </Link>
        </div>
        <section className="panel empty">
          <h2>No season to rank yet.</h2>
          <p>
            {data.user
              ? "Create a season, divisions, and teams in League HQ to start the table."
              : "Standings will be posted once the season begins."}
          </p>
        </section>
      </main>
    );

  const { supabase } = await getLeagueContext();

  const standingsRes = await supabase.rpc("get_season_standings", {
    target_season: selectedSeason.id,
  });

  const parsedRows = z.array(standingsRowSchema).safeParse(standingsRes.data);
  const rows =
    parsedRows.success && parsedRows.data.length > 0
      ? parsedRows.data
      : getUnifiedLeagueStandings(data.league.id, data.league.name, data.teams);

  return (
    <main id="main" className="public-portal-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">OFFICIAL TABLE</p>
          <h1>Standings</h1>
          <p>{data.league.name} · Official Division Standings</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button primary" href="/leaders">
            Player &amp; Goalie Leaders →
          </Link>
          <Link className="button" href="/schedule">
            Schedules &amp; Scores
          </Link>
        </div>
      </div>

      <section className="panel">
        <form action="/standings" method="get" className="filter-bar">
          <label>
            Season
            <select name="season" defaultValue={selectedSeason.id}>
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button primary">View Standings</button>
        </form>

        {standingsRes.error && !data.teams.length ? (
          <div className="notice" role="status">
            <h2>Official standings in setup</h2>
            <p>Standings will populate automatically once games begin.</p>
          </div>
        ) : (
          data.divisions
            .filter((division) => division.season_id === selectedSeason.id)
            .map((division) => {
              const divisionRows = rows ? rows.filter(
                (row) => row.division_id === division.id
              ) : [];
              const divisionTeams = data.teams.filter(
                (t) => t.division_name === division.name
              );
              const hasRows = divisionRows.length > 0;

              return (
                <section key={division.id} style={{ marginTop: "1.75rem" }}>
                  <div className="section-heading">
                    <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{division.name} Division</h2>
                    <span className="badge">{hasRows ? divisionRows.length : divisionTeams.length} Teams</span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col" className="rank-col">#</th>
                          <th scope="col" className="team-col">Team</th>
                          <th scope="col" className="stat-col">GP</th>
                          <th scope="col" className="stat-col">W</th>
                          <th scope="col" className="stat-col">T</th>
                          <th scope="col" className="stat-col">L</th>
                          <th scope="col" className="stat-col">OTL</th>
                          <th scope="col" className="stat-col">GF</th>
                          <th scope="col" className="stat-col">GA</th>
                          <th scope="col" className="stat-col">GD</th>
                          <th scope="col" className="stat-col">PIM</th>
                          <th scope="col" className="stat-pts">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hasRows ? (
                          divisionRows.map((row) => {
                            const initials = (row.team_name || "TM")
                              .split(/\s+/)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 3);

                            return (
                              <tr key={row.team_entry_id}>
                                <td className="rank-col"><strong>{row.rank}</strong></td>
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
                                      style={{ fontWeight: 700, fontSize: "0.95rem" }}
                                      title={`View ${row.team_name} team page`}
                                    >
                                      {row.team_name}
                                    </Link>
                                  </div>
                                </td>
                                <td className="stat-col">{row.games_played}</td>
                                <td className="stat-col">{row.wins}</td>
                                <td className="stat-col">{row.ties}</td>
                                <td className="stat-col">{row.losses}</td>
                                <td className="stat-col">{row.overtime_losses}</td>
                                <td className="stat-col">{row.goals_for}</td>
                                <td className="stat-col">{row.goals_against}</td>
                                <td className="stat-col">
                                  {row.goal_difference > 0 ? "+" : ""}
                                  {row.goal_difference}
                                </td>
                                <td className="stat-col">{row.penalty_minutes}</td>
                                <td className="stat-pts">
                                  {row.points}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          divisionTeams.map((t, idx) => {
                            const initials = (t.name || "TM")
                              .split(/\s+/)
                              .map((w) => w[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 3);

                            return (
                              <tr key={t.entry_id}>
                                <td className="rank-col"><strong>{idx + 1}</strong></td>
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
                                <td className="stat-col">0</td>
                                <td className="stat-col">0</td>
                                <td className="stat-col">0</td>
                                <td className="stat-col">0</td>
                                <td className="stat-col">0</td>
                                <td className="stat-pts">0</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
        )}

        <p className="field-help">
          Only independently approved results count. Points and tiebreaker order use the
          season settings. Pending, corrected, and unreviewed scores are excluded.
        </p>
      </section>
    </main>
  );
}
