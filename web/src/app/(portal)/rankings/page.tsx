import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

interface NetworkRankingRow {
  network_rank: number;
  team_id: string;
  team_name: string;
  league_id: string;
  league_name: string;
  skill_tier: string;
  rating_score: number;
  games_played: number;
  goal_differential: number;
}

export default async function NetworkRankingsPage({
  searchParams,
}: {
  searchParams?: { tier?: string };
}) {
  const { supabase, league } = await getLeagueContext();
  const selectedTier = searchParams?.tier || null;

  const { data: rawRankings } = await supabase.rpc(
    "get_network_cross_league_rankings",
    {
      p_skill_tier: selectedTier,
    }
  );

  const rankings: NetworkRankingRow[] = rawRankings || [];

  const tiers = ["All", "AAA", "AA", "A", "B", "C", "Rec"];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAIONN HOCKEY NETWORK</p>
          <h1>Power Rankings &amp; Circuit Standings</h1>
          <p>Cross-league skill ratings computed from approved game results</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "#666" }}>Filter Tier:</span>
          {tiers.map((t) => {
            const isSelected = (t === "All" && !selectedTier) || selectedTier === t;
            return (
              <Link
                key={t}
                href={t === "All" ? "/rankings" : `/rankings?tier=${t}`}
                className={`button small ${isSelected ? "primary" : ""}`}
              >
                {t}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="panel">
        {rankings.length === 0 ? (
          <div className="empty">
            <h2>No Rankings Computed Yet</h2>
            <p>Power ratings update dynamically after games are approved by league officials.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Rank</th>
                  <th>Team</th>
                  <th>League Circuit</th>
                  <th>Tier</th>
                  <th>Rating</th>
                  <th>GP</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => {
                  const isCurrentLeague = r.league_id === league.id;
                  return (
                    <tr
                      key={`${r.league_id}-${r.team_id}`}
                      style={{
                        background: isCurrentLeague ? "rgba(59, 130, 246, 0.05)" : undefined,
                      }}
                    >
                      <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: "bold" }}>
                        #{r.network_rank}
                      </td>
                      <td>
                        <strong>{r.team_name}</strong>
                        {isCurrentLeague && (
                          <span className="badge info" style={{ marginLeft: "8px", fontSize: "0.7rem" }}>
                            THIS LEAGUE
                          </span>
                        )}
                      </td>
                      <td>{r.league_name}</td>
                      <td>
                        <span className="badge neutral">{r.skill_tier}</span>
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: "bold" }}>
                        {Number(r.rating_score).toFixed(1)}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.games_played}</td>
                      <td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: r.goal_differential > 0 ? "#16a34a" : r.goal_differential < 0 ? "#dc2626" : undefined,
                        }}
                      >
                        {r.goal_differential > 0 ? `+${r.goal_differential}` : r.goal_differential}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
