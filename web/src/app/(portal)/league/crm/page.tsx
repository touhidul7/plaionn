import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";
import { sanitizeSeasonName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

interface WaitlistEntry {
  id: string;
  waitlist_type: string;
  applicant_name: string;
  contact_email: string;
  contact_phone?: string;
  skill_level?: string;
  preferred_positions?: string[];
  status: string;
  notes?: string;
  created_at: string;
}

interface RetentionStats {
  base_season_players: number;
  compare_season_players: number;
  returning_players: number;
  churned_players_count: number;
  new_players_count: number;
  retention_rate_pct: number;
  churned_sample: Array<{ player_id: string; display_name: string; last_team: string }>;
}

export default async function CRMAndRetentionPage({
  searchParams,
}: {
  searchParams?: { baseSeason?: string; compareSeason?: string };
}) {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>League Waitlists &amp; CRM</h1>
        <p>Only league commissioners may manage division waitlists and player retention analytics.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // 1. Fetch seasons for retention comparison
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("league_id", league.id)
    .order("created_at", { ascending: false });

  const activeSeasons = (seasons || []).map((s) => ({
    ...s,
    name: sanitizeSeasonName(s.name),
  }));
  const baseSeasonId = searchParams?.baseSeason || (activeSeasons.length > 1 ? activeSeasons[1].id : activeSeasons[0]?.id);
  const compareSeasonId = searchParams?.compareSeason || activeSeasons[0]?.id;

  // 2. Fetch waitlist & retention stats
  const [waitlistRes, retentionRes] = await Promise.all([
    supabase
      .from("division_waitlists")
      .select("*")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
    baseSeasonId && compareSeasonId && baseSeasonId !== compareSeasonId
      ? supabase.rpc("get_league_retention_analytics", {
          target_league: league.id,
          base_season_id: baseSeasonId,
          compare_season_id: compareSeasonId,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const waitlist: WaitlistEntry[] = waitlistRes.data || [];
  const retention: RetentionStats | null = retentionRes.data;

  async function updateWaitlistStatus(formData: FormData) {
    "use server";
    const entryId = formData.get("entryId") as string;
    const nextStatus = formData.get("status") as string;
    const notes = formData.get("notes") as string;

    const { supabase: actionClient } = await getLeagueContext();
    await actionClient.rpc("manage_waitlist_status", {
      target_entry_id: entryId,
      new_status: nextStatus,
      admin_notes: notes || null,
    });
    revalidatePath("/league/crm");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEAGUE SUPPORT &amp; RETENTION</p>
          <h1>Waitlists &amp; Retention Analytics</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      {/* Retention Analytics Section */}
      <div className="section-heading">
        <h2>Season-over-Season Retention</h2>
        <span>Analyze player continuity and churn across consecutive seasons</span>
      </div>

      <div className="metrics-grid" style={{ marginBottom: "2rem" }}>
        <div className="metric-card">
          <p className="metric-label">RETENTION RATE</p>
          <p className="metric-value">
            {retention ? `${retention.retention_rate_pct}%` : "100%"}
          </p>
          <span className="metric-detail">
            {retention
              ? `${retention.returning_players} of ${retention.base_season_players} players returned`
              : "Base comparison pending"}
          </span>
        </div>
        <div className="metric-card">
          <p className="metric-label">NEW PLAYERS</p>
          <p className="metric-value">{retention ? retention.new_players_count : 0}</p>
          <span className="metric-detail">Fresh signups in active season</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">CHURNED PLAYERS</p>
          <p className="metric-value">{retention ? retention.churned_players_count : 0}</p>
          <span className="metric-detail">Inactive compared to prior season</span>
        </div>
      </div>

      {retention && retention.churned_sample && retention.churned_sample.length > 0 && (
        <section className="panel" style={{ marginBottom: "2rem" }}>
          <h3>Players Needing Outreach</h3>
          <p className="hint">Players from the prior season who have not yet registered for the current season:</p>
          <div className="table-wrapper" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Player Name</th>
                  <th>Last Team</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {retention.churned_sample.map((p) => (
                  <tr key={p.player_id}>
                    <td><strong>{p.display_name}</strong></td>
                    <td>{p.last_team}</td>
                    <td>
                      <span className="badge warning">Needs Follow-up</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Waitlist Section */}
      <div className="section-heading">
        <h2>Division Waitlist Queue</h2>
        <span>Manage full division waitlists and offer openings to interested players and teams</span>
      </div>

      <section className="panel">
        {waitlist.length === 0 ? (
          <div className="empty">
            <p>No teams or players currently on the waitlist.</p>
            <p className="hint">When divisions fill to capacity, interested applicants appear here automatically.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Skill / Positions</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.applicant_name}</strong>
                      {entry.notes && <p className="hint" style={{ margin: "2px 0 0" }}>{entry.notes}</p>}
                    </td>
                    <td>
                      <span className="badge info">
                        {entry.waitlist_type === "team" ? "TEAM" : "PLAYER"}
                      </span>
                    </td>
                    <td>
                      <div>{entry.contact_email}</div>
                      {entry.contact_phone && <div className="hint">{entry.contact_phone}</div>}
                    </td>
                    <td>
                      <div>{entry.skill_level || "Any Skill"}</div>
                      {entry.preferred_positions && (
                        <div className="hint">{entry.preferred_positions.join(", ")}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          entry.status === "accepted"
                            ? "success"
                            : entry.status === "offered"
                            ? "info"
                            : entry.status === "declined"
                            ? "warning"
                            : "neutral"
                        }`}
                      >
                        {entry.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <form action={updateWaitlistStatus} style={{ display: "flex", gap: "6px" }}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <select
                          name="status"
                          defaultValue={entry.status}
                          style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "4px" }}
                        >
                          <option value="pending">Pending</option>
                          <option value="offered">Offer Spot</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button type="submit" className="button small">
                          Save
                        </button>
                      </form>
                    </td>
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
