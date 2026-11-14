import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface NetworkOrg {
  id: string;
  name: string;
}

interface ExecutiveKpis {
  organization_id: string;
  total_leagues: number;
  total_seasons: number;
  total_teams: number;
  total_unique_players: number;
  total_games: number;
  completed_games: number;
  game_completion_pct: number;
  leagues: Array<{
    league_id: string;
    league_name: string;
    team_count: number;
    player_count: number;
    game_count: number;
  }>;
}

export default async function NetworkHqPage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>Multi-League Network HQ</h1>
        <p>Only multi-league franchise owners may access network rollups.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch or find network organizations owned by this user
  const { data: orgs } = await supabase
    .from("network_organizations")
    .select("*")
    .eq("owner_user_id", user.id);

  let activeOrg: NetworkOrg | null = orgs && orgs.length > 0 ? orgs[0] : null;

  let kpis: ExecutiveKpis | null = null;
  if (activeOrg) {
    const res = await supabase.rpc("get_network_executive_kpis", {
      target_org_id: activeOrg.id,
    });
    kpis = res.data;
  }

  async function createOrgAction(formData: FormData) {
    "use server";
    const orgName = formData.get("orgName") as string;
    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();
    const { data: newOrg } = await actionClient.rpc("create_network_organization", {
      p_name: orgName,
    });
    if (newOrg) {
      await actionClient.rpc("add_league_to_network", {
        target_org_id: newOrg.id,
        target_league_id: actionLeague.id,
      });
    }
    revalidatePath("/league/network");
  }

  async function linkCurrentLeagueAction(formData: FormData) {
    "use server";
    const orgId = formData.get("orgId") as string;
    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();
    await actionClient.rpc("add_league_to_network", {
      target_org_id: orgId,
      target_league_id: actionLeague.id,
    });
    revalidatePath("/league/network");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EXECUTIVE ROLLUP</p>
          <h1>Multi-League Network HQ</h1>
          <p>Portfolio operations and combined performance across all circuits</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      {!activeOrg ? (
        <section className="panel">
          <h2>Create Your Multi-League Network</h2>
          <p className="hint">Group multiple regional leagues or rink operations under one executive dashboard.</p>
          <form action={createOrgAction} style={{ marginTop: "1rem", display: "flex", gap: "8px", maxWidth: "480px" }}>
            <input
              type="text"
              name="orgName"
              placeholder="e.g. National Hockey Circuit"
              required
              style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            <button type="submit" className="button primary">
              Create Network
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="metrics-grid" style={{ marginBottom: "2rem" }}>
            <div className="metric-card">
              <p className="metric-label">NETWORK LEAGUES</p>
              <p className="metric-value">{kpis?.total_leagues || 1}</p>
              <span className="metric-detail">Active circuits managed</span>
            </div>
            <div className="metric-card">
              <p className="metric-label">TOTAL TEAMS</p>
              <p className="metric-value">{kpis?.total_teams || 0}</p>
              <span className="metric-detail">Across all divisions</span>
            </div>
            <div className="metric-card">
              <p className="metric-label">REGISTERED PLAYERS</p>
              <p className="metric-value">{kpis?.total_unique_players || 0}</p>
              <span className="metric-detail">Total active network participants</span>
            </div>
            <div className="metric-card">
              <p className="metric-label">GAME COMPLETION</p>
              <p className="metric-value">{kpis?.game_completion_pct || 0}%</p>
              <span className="metric-detail">
                {kpis?.completed_games || 0} of {kpis?.total_games || 0} games completed
              </span>
            </div>
          </div>

          <div className="section-heading">
            <div>
              <h2>Participating Leagues in {activeOrg.name}</h2>
              <span>Aggregated operations and team counts</span>
            </div>
            <form action={linkCurrentLeagueAction}>
              <input type="hidden" name="orgId" value={activeOrg.id} />
              <button type="submit" className="button small">
                + Link {league.name}
              </button>
            </form>
          </div>

          <section className="panel">
            {kpis && kpis.leagues && kpis.leagues.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>League</th>
                      <th>Teams</th>
                      <th>Players</th>
                      <th>Total Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.leagues.map((l) => (
                      <tr key={l.league_id}>
                        <td>
                          <strong>{l.league_name}</strong>
                          {l.league_id === league.id && (
                            <span className="badge info" style={{ marginLeft: "8px", fontSize: "0.7rem" }}>
                              ACTIVE SESSION
                            </span>
                          )}
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{l.team_count}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{l.player_count}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{l.game_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hint">No leagues connected to this organization yet.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
