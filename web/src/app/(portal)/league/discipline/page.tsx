import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { DisciplineLedger } from "@/components/discipline-ledger";
import type { DisciplineIncidentItem } from "@/lib/discipline-schema";

export const dynamic = "force-dynamic";

export default async function DisciplinePage() {
  const [data, context] = await Promise.all([getLeagueData(), getLeagueContext()]);
  const { supabase, leagueId, canManage, user } = context;

  // 1. Fetch disciplinary incidents
  const { data: incidentRows, error: incErr } = await supabase.rpc("list_league_discipline", {
    target_league: leagueId,
  });

  const incidents: DisciplineIncidentItem[] =
    !incErr && Array.isArray(incidentRows) ? (incidentRows as DisciplineIncidentItem[]) : [];

  // 2. Fetch rosters and players to populate player picker
  const { data: rosterRows } = await supabase
    .from("roster_memberships")
    .select("player_id, jersey_number, team_entry_id")
    .eq("league_id", leagueId)
    .eq("status", "active");

  const playerIds = Array.from(new Set((rosterRows || []).map((r) => r.player_id)));
  const { data: playerRows } = playerIds.length > 0
    ? await supabase.from("players").select("id, display_name").in("id", playerIds)
    : { data: [] };

  const playerMap = new Map((playerRows || []).map((p) => [p.id, p.display_name]));

  const teamsWithPlayers = (data.teams || []).map((entry) => {
    const matchingRoster = (rosterRows || []).filter((r) => r.team_entry_id === entry.entry_id);
    return {
      entryId: entry.entry_id,
      teamName: entry.name,
      players: matchingRoster.map((r) => ({
        id: r.player_id,
        name: playerMap.get(r.player_id) || "Player",
        jersey: r.jersey_number,
      })),
    };
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONS &amp; SAFETY</p>
          <h1>Discipline &amp; Suspensions</h1>
          <p>{data.league.name} · Player Eligibility, Incident Logs &amp; Appeals</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href="/league">
            League HQ
          </Link>
          <Link className="button" href="/teams">
            Teams &amp; Rosters
          </Link>
        </div>
      </div>

      <DisciplineLedger
        incidents={incidents}
        seasons={data.seasons.map((s) => ({ id: s.id, name: s.name }))}
        teams={teamsWithPlayers}
        canManage={canManage}
        currentUserId={user?.id ?? null}
      />
    </>
  );
}
