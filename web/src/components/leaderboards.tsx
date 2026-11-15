import Link from "next/link";
import type { SkaterLeader, GoalieLeader } from "@/lib/leaderboards-schema";

interface LeaderboardsProps {
  skaters: SkaterLeader[];
  goalies: GoalieLeader[];
}

export function SeasonLeaderboards({ skaters, goalies }: LeaderboardsProps) {
  return (
    <div style={{ display: "grid", gap: "2rem", marginTop: "2rem" }}>
      {/* Skater Leaders */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>🏒 Skater Scoring Race</h2>
          <span className="badge">{skaters.length} skaters qualified</span>
        </div>
        <p style={{ color: "var(--muted, #94a3b8)", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
          Points and penalty minutes compiled automatically from approved game sheets.
        </p>

        {skaters.length === 0 ? (
          <p className="empty">No skater scoring recorded for approved games in this season yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" className="rank-col">#</th>
                  <th scope="col" className="team-col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col" style={{ width: "52px", textAlign: "center" }}>Pos</th>
                  <th scope="col" className="stat-col">GP</th>
                  <th scope="col" className="stat-col">G</th>
                  <th scope="col" className="stat-col">A</th>
                  <th scope="col" className="stat-pts">PTS</th>
                  <th scope="col" className="stat-col">PIM</th>
                </tr>
              </thead>
              <tbody>
                {skaters.map((player, idx) => (
                  <tr key={player.player_id}>
                    <td className="rank-col"><strong>{idx + 1}</strong></td>
                    <td className="team-col">
                      <Link
                        href={`/players/${player.player_id}`}
                        className="text-link"
                        style={{ fontWeight: 700 }}
                        title={`View ${player.display_name} profile`}
                      >
                        {player.display_name}
                      </Link>
                      {player.jersey_number !== null && (
                        <span style={{ opacity: 0.6, marginLeft: "0.35rem" }}>#{player.jersey_number}</span>
                      )}
                    </td>
                    <td>{player.team_name}</td>
                    <td style={{ textAlign: "center" }}><span className="badge">{player.player_position}</span></td>
                    <td className="stat-col">{player.games_played}</td>
                    <td className="stat-col">{player.goals}</td>
                    <td className="stat-col">{player.assists}</td>
                    <td className="stat-pts">{player.points}</td>
                    <td className="stat-col">{player.penalty_minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
              * Skater scoring statistics (G, A, PTS, PIM) are compiled strictly from official game event logs verified by referees and commissioners.
            </p>
          </div>
        )}
      </section>

      {/* Goaltending Leaders */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>🥅 Goaltending Leaders</h2>
          <span className="badge">{goalies.length} goalies</span>
        </div>
        <p style={{ color: "var(--muted, #94a3b8)", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
          Goals against average (GAA) and shutouts compiled from approved game sheets.
        </p>

        {goalies.length === 0 ? (
          <p className="empty">No goaltending records found for approved games in this season yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" className="rank-col">#</th>
                  <th scope="col" className="team-col">Goaltender</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="stat-col">GP</th>
                  <th scope="col" className="stat-col">GA</th>
                  <th scope="col" className="stat-pts">GAA</th>
                  <th scope="col" className="stat-col">SO</th>
                </tr>
              </thead>
              <tbody>
                {goalies.map((goalie, idx) => (
                  <tr key={goalie.player_id}>
                    <td className="rank-col"><strong>{idx + 1}</strong></td>
                    <td className="team-col">
                      <Link
                        href={`/players/${goalie.player_id}`}
                        className="text-link"
                        style={{ fontWeight: 700 }}
                        title={`View ${goalie.display_name} profile`}
                      >
                        {goalie.display_name}
                      </Link>
                      {goalie.jersey_number !== null && (
                        <span style={{ opacity: 0.6, marginLeft: "0.35rem" }}>#{goalie.jersey_number}</span>
                      )}
                    </td>
                    <td>{goalie.team_name}</td>
                    <td className="stat-col">{goalie.games_played}</td>
                    <td className="stat-col">{goalie.goals_against}</td>
                    <td className="stat-pts">
                      {Number(goalie.goals_against_average).toFixed(2)}
                    </td>
                    <td className="stat-col">{goalie.shutouts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
              * Goaltender metrics (GAA, GA, SO) are calculated strictly from verified official match scoresheets. Advanced statistics (such as Save Percentage and Shot Differentials) are presented exclusively for fixtures where official rink-side shot counts were actively tracked.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

