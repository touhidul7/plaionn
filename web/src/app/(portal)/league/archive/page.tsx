import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface HistoricalSeason {
  id: string;
  season_name: string;
  year_label?: string;
  champion_team?: string;
  runner_up_team?: string;
  notes?: string;
  created_at: string;
}

export default async function LeagueArchivePage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>League Archives &amp; Historical Seasons</h1>
        <p>Only league commissioners may import and manage historical season archives.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch historical seasons
  const { data: rawSeasons } = await supabase
    .from("historical_seasons")
    .select("*, historical_standings(*)")
    .eq("league_id", league.id)
    .order("created_at", { ascending: false });

  const historicalSeasons: HistoricalSeason[] = rawSeasons || [];

  async function importHistoricalSeasonAction(formData: FormData) {
    "use server";
    const seasonName = formData.get("seasonName") as string;
    const yearLabel = formData.get("yearLabel") as string;
    const championTeam = formData.get("championTeam") as string;
    const rawJson = formData.get("dataJson") as string;

    let payload: any = {};
    if (rawJson && rawJson.trim().length > 0) {
      try {
        payload = JSON.parse(rawJson);
      } catch (e) {
        // Fallback to basic fields
      }
    }

    payload.season_name = seasonName;
    payload.year_label = yearLabel;
    payload.champion_team = championTeam;
    payload.auto_match_players = true;

    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();
    await actionClient.rpc("import_historical_season", {
      target_league: actionLeague.id,
      payload,
    });
    revalidatePath("/league/archive");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECORDS &amp; ARCHIVES</p>
          <h1>Historical Seasons &amp; Past Champions</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      <div className="section-heading">
        <h2>Archived Seasons &amp; Champions</h2>
        <span>Completed historical seasons with preserved standings and career continuity</span>
      </div>

      <section className="panel">
        {historicalSeasons.length === 0 ? (
          <div className="empty">
            <p>No historical seasons imported yet.</p>
            <p className="hint">Import past season records below to preserve your league&apos;s history and career records.</p>
          </div>
        ) : (
          <div className="cards">
            {historicalSeasons.map((s) => (
              <div key={s.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3>{s.season_name}</h3>
                  {s.year_label && <span className="badge neutral">{s.year_label}</span>}
                </div>
                {s.champion_team && (
                  <p style={{ marginTop: "8px" }}>
                    🏆 <strong>Champion:</strong> {s.champion_team}
                  </p>
                )}
                {s.runner_up_team && (
                  <p className="hint">Runner-up: {s.runner_up_team}</p>
                )}
                {s.notes && <p className="hint" style={{ marginTop: "4px" }}>{s.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <h2>Import Historical Season</h2>
        <span>Upload past records to seamlessly link historical player scoring to active profiles</span>
      </div>

      <section className="panel">
        <form action={importHistoricalSeasonAction} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "600px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Season Name</label>
            <input
              type="text"
              name="seasonName"
              placeholder="e.g. Winter 2023-24 Historical"
              required
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Year Label</label>
            <input
              type="text"
              name="yearLabel"
              placeholder="e.g. 2023-2024"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Champion Team</label>
            <input
              type="text"
              name="championTeam"
              placeholder="e.g. Oilers"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
              Standings &amp; Player Stats (JSON)
            </label>
            <textarea
              name="dataJson"
              rows={5}
              placeholder='{"standings": [{"team_name": "Oilers", "w": 16, "l": 3, "pts": 33}], "skaters": [{"player_name": "Wayne Gretzky", "team_name": "Oilers", "g": 35, "a": 45}]}'
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontFamily: "monospace", fontSize: "0.85rem" }}
            />
            <span className="hint">Optional: paste JSON exported from Excel or past records. Player names match automatically.</span>
          </div>
          <button type="submit" className="button primary" style={{ alignSelf: "flex-start", marginTop: "8px" }}>
            Import Historical Season
          </button>
        </form>
      </section>
    </>
  );
}
