import Link from "next/link";
import { z } from "zod";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";

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
      <>
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
      </>
    );

  const { supabase } = await getLeagueContext();

  const standingsRes = await supabase.rpc("get_season_standings", {
    target_season: selectedSeason.id,
  });

  const parsedRows = z.array(standingsRowSchema).safeParse(standingsRes.data);
  const rows = parsedRows.success ? parsedRows.data : null;

  return (
    <>
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

        {standingsRes.error || !rows ? (
          <div className="notice" role="status">
            <h2>Official standings unavailable</h2>
            <p>
              {standingsRes.error?.code === "PGRST202" || standingsRes.error?.code === "42883"
                ? "Apply the game-results and standings migration before viewing official standings."
                : standingsRes.error?.code === "42501"
                ? "Guest standings access is pending migration in Supabase."
                : "Could not calculate standings from the connected database."}
            </p>
          </div>
        ) : rows?.length ? (
          data.divisions
            .filter((division) => division.season_id === selectedSeason.id)
            .map((division) => {
              const divisionRows = rows.filter(
                (row) => row.division_id === division.id
              );
              return (
                <section key={division.id} style={{ marginTop: "1.75rem" }}>
                  <div className="section-heading">
                    <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{division.name}</h2>
                    <span className="badge">{divisionRows.length} Teams</span>
                  </div>
                  {divisionRows.length ? (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col" style={{ width: "3rem" }}>#</th>
                            <th scope="col">Team</th>
                            <th scope="col">GP</th>
                            <th scope="col">W</th>
                            <th scope="col">T</th>
                            <th scope="col">L</th>
                            <th scope="col">OTL</th>
                            <th scope="col">GF</th>
                            <th scope="col">GA</th>
                            <th scope="col">GD</th>
                            <th scope="col">PIM</th>
                            <th scope="col" style={{ color: "var(--lime)", fontWeight: 800 }}>PTS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {divisionRows.map((row) => (
                            <tr key={row.team_entry_id}>
                              <td><strong>{row.rank}</strong></td>
                              <td>
                                <Link
                                  href={`/teams/${row.team_entry_id}`}
                                  className="text-link"
                                  style={{ fontWeight: 700, fontSize: "0.95rem" }}
                                  title={`View ${row.team_name} team page`}
                                >
                                  {row.team_name}
                                </Link>
                              </td>
                              <td>{row.games_played}</td>
                              <td>{row.wins}</td>
                              <td>{row.ties}</td>
                              <td>{row.losses}</td>
                              <td>{row.overtime_losses}</td>
                              <td>{row.goals_for}</td>
                              <td>{row.goals_against}</td>
                              <td>
                                {row.goal_difference > 0 ? "+" : ""}
                                {row.goal_difference}
                              </td>
                              <td>{row.penalty_minutes}</td>
                              <td>
                                <strong style={{ color: "var(--lime)", fontSize: "1.05rem" }}>{row.points}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty">No teams in this division yet.</p>
                  )}
                </section>
              );
            })
        ) : (
          <section className="empty">
            <h2>No divisions for {selectedSeason.name}.</h2>
            <p>Add divisions and teams in League HQ to begin tracking standings.</p>
          </section>
        )}

        <p className="field-help">
          Only independently approved results count. Points and tiebreaker order use the
          season settings. Pending, corrected, and unreviewed scores are excluded.
        </p>
      </section>
    </>
  );
}
