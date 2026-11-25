import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
import { getAdminAccess } from "@/lib/supabase/admin";
import { PlayerForm, RosterForm, EligibilityCard } from "@/components/roster-forms";
import { RosterCsvImportModal } from "@/components/roster-csv-import";
import { TeamCaptainManager, type TeamMemberItem } from "@/components/team-captain-manager";
import { teamEligibilitySchema, type PlayerOption, type RosterRow } from "@/lib/roster-schema";
import { sanitizeLeagueName, sanitizeSeasonName, sanitizePlayerName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

interface SkaterStatRow {
  player_id: string;
  display_name: string;
  team_entry_id: string;
  team_name: string;
  jersey_number: number | null;
  player_position: string | null;
  games_played: number;
  goals: number;
  assists: number;
  points: number;
  penalty_minutes: number;
}

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  if (!z.uuid().safeParse(entryId).success) notFound();

  const context = await getLeagueContext();
  const { supabase, user } = context;

  // Resolve team directly from team_entries (prevents cookie mismatch)
  const { data: dbEntry, error: dbEntryErr } = await supabase
    .from("team_entries")
    .select(`
      id,
      team_id,
      division_id,
      league_id,
      teams(id, name),
      divisions(id, name, season_id, seasons(id, name)),
      leagues(id, name)
    `)
    .eq("id", entryId)
    .maybeSingle();

  if (dbEntryErr || !dbEntry) notFound();

  const realLeagueId = dbEntry.league_id;
  const teamName = (dbEntry.teams as any)?.name ?? "Team Roster";
  const divisionName = (dbEntry.divisions as any)?.name ?? "Premier";
  const seasonName = sanitizeSeasonName((dbEntry.divisions as any)?.seasons?.name ?? "Winter Season");
  const targetSeasonId = (dbEntry.divisions as any)?.season_id ?? (dbEntry.divisions as any)?.seasons?.id ?? "";

  // Check management access
  const access = await getAdminAccess();
  const canManage = Boolean(
    user && (access.isPlatformAdmin || access.canManageLeague(realLeagueId))
  );

  // Fetch player stats using public security-definer RPC
  let playerStats: SkaterStatRow[] = [];
  try {
    if (targetSeasonId) {
      const { data: statsData } = await supabase.rpc("get_season_skater_leaders", {
        target_season: targetSeasonId,
      });
      if (statsData && Array.isArray(statsData)) {
        playerStats = statsData
          .filter((r: any) => r.team_entry_id === entryId)
          .map((r: any) => ({
            player_id: r.player_id,
            display_name: sanitizePlayerName(r.display_name),
            team_entry_id: r.team_entry_id,
            team_name: r.team_name,
            jersey_number: r.jersey_number,
            player_position: r.player_position ?? "F",
            games_played: Number(r.games_played ?? 0),
            goals: Number(r.goals ?? 0),
            assists: Number(r.assists ?? 0),
            points: Number(r.points ?? 0),
            penalty_minutes: Number(r.penalty_minutes ?? 0),
          }));
      }
    }
  } catch {
    // Graceful fallback
  }

  // Fetch verified roster rows
  let rosterData: RosterRow[] = [];
  let availablePlayers: PlayerOption[] = [];
  let allPlayersList: PlayerOption[] = [];
  let eligibilityList: any[] = [];
  let overrideHistory: any[] = [];
  let rosterLimit = 25;
  let billingSummary: any = null;

  try {
    const [rosterRes, linksRes, settingsRes, billingRes] = await Promise.all([
      supabase
        .from("roster_memberships")
        .select("id,player_id,jersey_number,position,status,revision")
        .eq("team_entry_id", entryId)
        .order("jersey_number"),
      supabase
        .from("league_players")
        .select("player_id")
        .eq("league_id", realLeagueId),
      targetSeasonId
        ? supabase
            .from("season_settings")
            .select("roster_limit")
            .eq("season_id", targetSeasonId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      canManage
        ? supabase.rpc("get_team_billing_summary", { target_entry: entryId })
        : Promise.resolve({ data: null }),
    ]);

    if (rosterRes.data) {
      rosterData = rosterRes.data as RosterRow[];
    }
    if (settingsRes.data?.roster_limit) {
      rosterLimit = settingsRes.data.roster_limit;
    }
    if (billingRes.data && Array.isArray(billingRes.data) && billingRes.data.length > 0) {
      billingSummary = billingRes.data[0];
    }

    // Load player profiles for players on this team and in the league
    const teamPlayerIds = rosterData.map((r) => r.player_id);
    const leaguePlayerIds = (linksRes.data || []).map((p: any) => p.player_id);
    const allUniqueIds = Array.from(new Set([...teamPlayerIds, ...leaguePlayerIds]));

    if (allUniqueIds.length > 0) {
      const { data: pData } = await supabase
        .from("players")
        .select("id,display_name")
        .in("id", allUniqueIds)
        .order("display_name");
      if (pData) {
        const sanitized = pData.map((p) => ({
          id: p.id,
          display_name: sanitizePlayerName(p.display_name),
        }));
        allPlayersList = sanitized;
        availablePlayers = sanitized.filter(
          (p) => !rosterData.some((r) => r.player_id === p.id)
        );
      }
    }

    // Eligibility and Overrides
    if (rosterData.length > 0) {
      const { data: oData } = await supabase
        .from("player_eligibility_overrides")
        .select("id,roster_membership_id,reason,granted_by,granted_at,revoked_by,revoked_at,revocation_reason")
        .in("roster_membership_id", rosterData.map((row) => row.id))
        .is("revoked_at", null);
      if (oData) {
        overrideHistory = oData;
      }
    }
  } catch {
    // Graceful fallback for management data
  }

  // Combine roster display: if manager has raw rosterData, merge with stats; otherwise use public stats
  type MergedPlayer = {
    id: string;
    player_id: string;
    jersey_number: number | null;
    display_name: string;
    position: string;
    status: string;
    revision?: number;
    gp: number;
    goals: number;
    assists: number;
    pts: number;
    pim: number;
  };

  const statMap = new Map(playerStats.map((s) => [s.player_id, s]));

  let finalRoster: MergedPlayer[] = [];

  if (rosterData.length > 0) {
    finalRoster = rosterData.map((r) => {
      const stat = statMap.get(r.player_id);
      const profile = allPlayersList.find((p) => p.id === r.player_id);
      return {
        id: r.id,
        player_id: r.player_id,
        jersey_number: r.jersey_number,
        display_name: profile?.display_name ?? stat?.display_name ?? "Player",
        position: r.position ?? stat?.player_position ?? "F",
        status: r.status ?? "active",
        revision: r.revision,
        gp: stat?.games_played ?? 0,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        pts: stat?.points ?? 0,
        pim: stat?.penalty_minutes ?? 0,
      };
    });
  } else if (playerStats.length > 0) {
    finalRoster = playerStats.map((s) => ({
      id: s.player_id,
      player_id: s.player_id,
      jersey_number: s.jersey_number,
      display_name: s.display_name,
      position: s.player_position ?? "F",
      status: "active",
      gp: s.games_played,
      goals: s.goals,
      assists: s.assists,
      pts: s.points,
      pim: s.penalty_minutes,
    }));
  }

  finalRoster.sort(
    (a, b) => (b.pts - a.pts) || ((a.jersey_number ?? 100) - (b.jersey_number ?? 100))
  );

  const activeCount = finalRoster.filter((r) => r.status === "active").length;

  const overrideSet = new Set((overrideHistory || []).map((o: any) => o.roster_membership_id));
  const overrideReasonMap = new Map((overrideHistory || []).map((o: any) => [o.roster_membership_id, o.reason]));

  const teamMembers: TeamMemberItem[] = rosterData.map((r) => {
    const profile = allPlayersList.find((p) => p.id === r.player_id);
    const hasOverride = overrideSet.has(r.id);
    return {
      id: r.id,
      playerId: r.player_id,
      name: profile?.display_name ?? "Player",
      jersey: r.jersey_number,
      position: r.position ?? "F",
      status: (r.status as "active" | "inactive") ?? "active",
      isCleared: hasOverride || r.status === "active",
      clearanceReason: hasOverride ? overrideReasonMap.get(r.id) : "Active on team roster",
      overrideId: hasOverride ? (overrideHistory.find((o: any) => o.roster_membership_id === r.id)?.id ?? null) : null,
    };
  });

  return (
    <main id="main" className="public-portal-container">
      {/* 1. Header with Team, Division, Season */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">{divisionName.toUpperCase()} · {seasonName.toUpperCase()}</p>
          <h1>{teamName}</h1>
          <p>
            {activeCount} active players · {finalRoster.length} total on verified roster
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {canManage && (
            <Link className="button" href={`/admin/league/${realLeagueId}?tab=teams`}>
              League Console
            </Link>
          )}
          <Link className="button" href="/teams">
            All teams
          </Link>
        </div>
      </div>

      {/* 2. Billing Status (Managers Only) */}
      {canManage && billingSummary && Number(billingSummary.total_billed_cents) > 0 && (
        <div className="panel" style={{ marginBottom: "20px" }}>
          <h2>Team Fee &amp; Payment Status</h2>
          <div style={{ display: "flex", gap: "24px", marginTop: "12px", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Total Invoiced</span>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
                ${(Number(billingSummary.total_billed_cents) / 100).toFixed(2)} {billingSummary.currency}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Paid</span>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px", color: "var(--lime)" }}>
                ${(Number(billingSummary.total_paid_cents) / 100).toFixed(2)} {billingSummary.currency}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Outstanding Balance</span>
              <p
                style={{
                  margin: 0,
                  fontWeight: "bold",
                  fontSize: "18px",
                  color: Number(billingSummary.balance_cents) > 0 ? "#ffd27a" : "var(--lime)",
                }}
              >
                ${(Number(billingSummary.balance_cents) / 100).toFixed(2)} {billingSummary.currency}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Captain Roster Management Hub (Real database records, claim links, group invite link) */}
      {canManage && (
        <TeamCaptainManager
          entryId={entryId}
          teamName={teamName}
          leagueId={realLeagueId}
          seasonId={targetSeasonId}
          seasonName={seasonName}
          canManage={canManage}
          roster={teamMembers}
        />
      )}

      {/* 3. Official Active Roster Table with Player Stats (theScore style) */}
      <section className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: "32px" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "16px", margin: 0 }}>Team Roster &amp; Player Statistics</h2>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Official regular season skater stats</span>
          </div>
          <span className="badge" style={{ fontSize: "11px" }}>
            {seasonName}
          </span>
        </div>
        {finalRoster.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: "55px" }}>#</th>
                  <th>PLAYER</th>
                  <th style={{ width: "65px" }}>POS</th>
                  <th style={{ width: "55px", textAlign: "center" }}>GP</th>
                  <th style={{ width: "55px", textAlign: "center" }}>G</th>
                  <th style={{ width: "55px", textAlign: "center" }}>A</th>
                  <th style={{ width: "55px", textAlign: "center", color: "var(--lime)" }}>PTS</th>
                  <th style={{ width: "55px", textAlign: "center" }}>PIM</th>
                  {canManage && <th style={{ width: "90px", textAlign: "right" }}>STATUS</th>}
                </tr>
              </thead>
              <tbody>
                {finalRoster.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: "var(--lime)" }}>
                      {r.jersey_number ? `#${r.jersey_number}` : "—"}
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      <Link href={`/players/${r.player_id}`} className="text-link" style={{ color: "var(--text)" }}>
                        {r.display_name}
                      </Link>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{r.position ? r.position.toUpperCase() : "SKATER"}</td>
                    <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{r.gp}</td>
                    <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{r.goals}</td>
                    <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{r.assists}</td>
                    <td style={{ textAlign: "center", fontWeight: 800, color: "var(--lime)", fontVariantNumeric: "tabular-nums" }}>{r.pts}</td>
                    <td style={{ textAlign: "center", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{r.pim}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <span className="badge" style={{ fontSize: "10px" }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
            No players assigned to this roster yet.
          </div>
        )}
      </section>

      {/* 4. Commissioner / Manager Controls (HIDDEN from Public Guests) */}
      {canManage && (
        <>
          <div className="section-heading" style={{ marginTop: "32px", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Add Players to Roster</h2>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Create a new profile or assign registered players</span>
            </div>
            <RosterCsvImportModal
              entryId={entryId}
              existingRoster={rosterData.map((r) => ({
                jersey_number: r.jersey_number,
                status: r.status,
                display_name: allPlayersList.find((p) => p.id === r.player_id)?.display_name ?? "Player",
              }))}
              rosterLimit={rosterLimit}
            />
          </div>

          <div className="roster-create">
            <PlayerForm />
            <RosterForm
              key={availablePlayers.map((p) => p.id).join(",")}
              entryId={entryId}
              players={availablePlayers}
            />
          </div>

          <div className="section-heading">
            <h2>Manage Player Numbers &amp; Status</h2>
            <span>Deactivate players to retain their history</span>
          </div>

          {rosterData.length ? (
            <div className="roster-list">
              {rosterData.map((row) => (
                <RosterForm
                  key={row.id + ":" + row.revision}
                  entryId={entryId}
                  players={allPlayersList}
                  row={row}
                />
              ))}
            </div>
          ) : null}

          {eligibilityList.length > 0 && (
            <>
              <div className="section-heading">
                <h2>Game eligibility</h2>
                <span>Commissioner overrides require a reason and remain audited</span>
              </div>

              <div className="roster-list">
                {eligibilityList.map((row) => (
                  <EligibilityCard key={row.roster_membership_id} entryId={entryId} eligibility={row} />
                ))}
              </div>
            </>
          )}

          {overrideHistory.length > 0 && (
            <section className="panel">
              <h2>Eligibility override history</h2>
              {overrideHistory.map((override) => (
                <div className="list-row" key={override.id}>
                  <strong>
                    {allPlayersList.find(
                      (player) =>
                        player.id ===
                        rosterData.find((row) => row.id === override.roster_membership_id)?.player_id
                    )?.display_name ?? "Player"}
                  </strong>
                  <p>
                    Granted {override.granted_at} by {override.granted_by.slice(0, 8)}:{" "}
                    {override.reason}
                  </p>
                  {override.revoked_at && (
                    <p>
                      Revoked {override.revoked_at} by {override.revoked_by?.slice(0, 8)}:{" "}
                      {override.revocation_reason}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
