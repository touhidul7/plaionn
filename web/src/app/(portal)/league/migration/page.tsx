import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface MigrationJob {
  id: string;
  source_platform: string;
  status: string;
  total_rows: number;
  imported_divisions: number;
  imported_teams: number;
  imported_players: number;
  created_at: string;
  completed_at?: string;
}

export default async function LeagueMigrationPage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>League Migration Wizard</h1>
        <p>Only league commissioners may import historical and legacy league data.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch active season and past migration jobs
  const [seasonsRes, jobsRes] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("league_migration_jobs")
      .select("*")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
  ]);

  const seasons = seasonsRes.data || [];
  const jobs: MigrationJob[] = jobsRes.data || [];

  async function executeMigrationAction(formData: FormData) {
    "use server";
    const seasonId = formData.get("seasonId") as string;
    const platform = formData.get("platform") as string;
    const rawDivisions = formData.get("divisionsJson") as string;
    const rawTeams = formData.get("teamsJson") as string;
    const rawPlayers = formData.get("playersJson") as string;

    let divisions = [];
    let teams = [];
    let players = [];

    try {
      if (rawDivisions) divisions = JSON.parse(rawDivisions);
      if (rawTeams) teams = JSON.parse(rawTeams);
      if (rawPlayers) players = JSON.parse(rawPlayers);
    } catch (e) {
      // JSON format parsing error fallback
    }

    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();
    await actionClient.rpc("execute_league_migration", {
      target_league: actionLeague.id,
      target_season: seasonId,
      p_platform: platform,
      p_divisions: divisions,
      p_teams: teams,
      p_players: players,
    });
    revalidatePath("/league/migration");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DATA ONBOARDING</p>
          <h1>League Migration Wizard</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      <div className="section-heading">
        <h2>Import Legacy Platform Data</h2>
        <span>Bulk migrate complete league structures from TeamSnap, Pointstreak, GoalLine, LeagueApps, or CSV</span>
      </div>

      <section className="panel" style={{ marginBottom: "2rem" }}>
        {seasons.length === 0 ? (
          <p className="hint">Please create an active season in League HQ before importing teams and rosters.</p>
        ) : (
          <form action={executeMigrationAction} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "680px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Destination Season</label>
              <select
                name="seasonId"
                required
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Source Platform</label>
              <select
                name="platform"
                defaultValue="teamsnap"
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              >
                <option value="teamsnap">TeamSnap</option>
                <option value="pointstreak">Pointstreak</option>
                <option value="goalline">GoalLine</option>
                <option value="leagueapps">LeagueApps</option>
                <option value="custom_csv">Custom CSV / Excel</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                Divisions (JSON / CSV list)
              </label>
              <textarea
                name="divisionsJson"
                rows={3}
                placeholder='[{"name": "Division A"}, {"name": "Division B"}]'
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontFamily: "monospace", fontSize: "0.85rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                Teams &amp; Division Mapping (JSON)
              </label>
              <textarea
                name="teamsJson"
                rows={4}
                placeholder='[{"name": "Avalanche", "division_name": "Division A"}, {"name": "Blizzards", "division_name": "Division B"}]'
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontFamily: "monospace", fontSize: "0.85rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
                Player Rosters (JSON)
              </label>
              <textarea
                name="playersJson"
                rows={5}
                placeholder='[{"name": "Nathan MacKinnon", "team_name": "Avalanche", "jersey_number": 29, "position": "C"}]'
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontFamily: "monospace", fontSize: "0.85rem" }}
              />
            </div>

            <button type="submit" className="button primary" style={{ alignSelf: "flex-start", marginTop: "6px" }}>
              Run Automated Migration
            </button>
          </form>
        )}
      </section>

      <div className="section-heading">
        <h2>Migration History &amp; Audit</h2>
        <span>Previous import batches and completed record counts</span>
      </div>

      <section className="panel">
        {jobs.length === 0 ? (
          <div className="empty">
            <p>No previous migration batches executed.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Divisions</th>
                  <th>Teams</th>
                  <th>Players</th>
                  <th>Total Records</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <strong>{j.source_platform.toUpperCase()}</strong>
                    </td>
                    <td>
                      <span className={`badge ${j.status === "completed" ? "success" : "info"}`}>
                        {j.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{j.imported_divisions}</td>
                    <td>{j.imported_teams}</td>
                    <td>{j.imported_players}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      <strong>{j.total_rows}</strong>
                    </td>
                    <td>{new Date(j.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
