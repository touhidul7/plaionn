import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

interface PoolStanding {
  entry_id: string;
  team_entry_id: string;
  team_name: string;
  seed: number;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  gf: number;
  ga: number;
}

interface Pool {
  pool_id: string;
  name: string;
  advancement_spots: number;
  standings: PoolStanding[];
}

interface TournamentOverview {
  id: string;
  name: string;
  tournament_type: string;
  start_date: string;
  end_date: string;
  status: string;
  max_teams: number;
  entry_fee_cents: number;
  pools: Pool[];
}

export default async function TournamentsPage() {
  const { supabase, league, canManage } = await getLeagueContext();

  // Fetch active tournaments
  let tournamentsList: { id: string }[] | null = null;
  let dbClient: any = supabase;
  if (league.id === "platform") {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      dbClient = createServiceClient();
      const { data } = await dbClient
        .from("tournaments")
        .select("id")
        .order("created_at", { ascending: false });
      tournamentsList = data;
    } catch {
      tournamentsList = [];
    }
  } else {
    const { data } = await supabase
      .from("tournaments")
      .select("id")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false });
    tournamentsList = data;
  }

  const tournaments: TournamentOverview[] = [];
  if (tournamentsList && tournamentsList.length > 0) {
    for (const t of tournamentsList) {
      const res = await dbClient.rpc("get_tournament_overview", {
        target_tournament: t.id,
      });
      if (res.data) {
        tournaments.push(res.data as TournamentOverview);
      }
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CHAMPIONSHIP SERIES</p>
          <h1>Tournaments &amp; Cups</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {canManage && (
            <Link href="/league" className="button primary">
              + Manage Tournaments
            </Link>
          )}
        </div>
      </div>

      {tournaments.length === 0 ? (
        <section className="panel empty">
          <h2>No Active Tournaments</h2>
          <p>Upcoming weekend cups, holiday tournaments, and playoff invitationals will appear here.</p>
        </section>
      ) : (
        tournaments.map((tourn) => (
          <div key={tourn.id} style={{ marginBottom: "2.5rem" }}>
            <div className="section-heading">
              <div>
                <h2>{tourn.name}</h2>
                <span>
                  {tourn.start_date} to {tourn.end_date} · {tourn.tournament_type.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <span className="badge success">{tourn.status.replace(/_/g, " ").toUpperCase()}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
              {tourn.pools.map((pool) => (
                <section key={pool.pool_id} className="panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0 }}>{pool.name}</h3>
                    <span className="hint">Top {pool.advancement_spots} advance</span>
                  </div>

                  {pool.standings.length === 0 ? (
                    <p className="hint">Teams being seeded...</p>
                  ) : (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Team</th>
                            <th>W</th>
                            <th>L</th>
                            <th>T</th>
                            <th>GF</th>
                            <th>GA</th>
                            <th>PTS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pool.standings.map((st, idx) => (
                            <tr
                              key={st.entry_id}
                              style={{
                                background: idx < pool.advancement_spots ? "rgba(34, 197, 94, 0.05)" : undefined,
                              }}
                            >
                              <td>
                                <strong>{st.team_name}</strong>
                                {idx < pool.advancement_spots && (
                                  <span style={{ marginLeft: "6px", fontSize: "0.75rem", color: "#16a34a" }}>
                                    ✓
                                  </span>
                                )}
                              </td>
                              <td>{st.wins}</td>
                              <td>{st.losses}</td>
                              <td>{st.ties}</td>
                              <td>{st.gf}</td>
                              <td>{st.ga}</td>
                              <td>
                                <strong>{st.points}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
