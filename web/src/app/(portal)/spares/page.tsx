import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { SparePoolView } from "@/components/spare-pool-view";
import type { SparePoolItem, GameCallupItem } from "@/lib/spares-schema";

export const dynamic = "force-dynamic";

export default async function SparesPage() {
  const [data, context] = await Promise.all([getLeagueData(), getLeagueContext()]);
  const { supabase, leagueId, canManage, user } = context;

  // 1. Fetch available spares
  let spares: SparePoolItem[] = [];
  let dbClient: any = supabase;
  if (leagueId === "platform") {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      dbClient = createServiceClient();
      const { data: allLeagues } = await dbClient.from("leagues").select("id");
      if (allLeagues && allLeagues.length > 0) {
        const sResults = await Promise.all(
          allLeagues.map((lg: { id: string }) =>
            dbClient.rpc("list_available_spares", { target_league: lg.id, target_position: "all" })
          )
        );
        spares = sResults.flatMap((r) => (!r.error && Array.isArray(r.data) ? (r.data as SparePoolItem[]) : []));
      }
    } catch {}
  } else {
    const { data: sparesRows, error: sErr } = await supabase.rpc("list_available_spares", {
      target_league: leagueId,
      target_position: "all",
    });
    spares = !sErr && Array.isArray(sparesRows) ? (sparesRows as SparePoolItem[]) : [];
  }

  // 2. Fetch user-owned players for registration
  let userPlayers: { id: string; name: string }[] = [];
  if (user) {
    const { data: owned } = await supabase
      .from("players")
      .select("id, display_name")
      .eq("owner_user_id", user.id);

    if (owned && owned.length > 0) {
      userPlayers = owned.map((p) => ({ id: p.id, name: p.display_name }));
    }
  }

  // 3. Fetch upcoming games for call-ups
  const gamesQuery = dbClient
    .from("games")
    .select("id, home_entry_id, away_entry_id, starts_at")
    .eq("status", "scheduled")
    .order("starts_at")
    .limit(10);
  const { data: gamesRows } = leagueId === "platform" ? await gamesQuery : await gamesQuery.eq("league_id", leagueId);

  const teamNameMap = new Map((data.teams || []).map((t) => [t.entry_id, t.name]));

  const formattedGames = (gamesRows || []).map((g: any) => {
    const homeName = teamNameMap.get(g.home_entry_id) || "Home";
    const awayName = teamNameMap.get(g.away_entry_id) || "Away";
    const dateStr = new Date(g.starts_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return {
      id: g.id,
      matchup: `${homeName} vs ${awayName}`,
      date: dateStr,
      homeEntryId: g.home_entry_id,
      awayEntryId: g.away_entry_id,
    };
  });

  // 4. Fetch recent call-ups
  const callupQuery = dbClient
    .from("game_spare_callups")
    .select(`
      id,
      game_id,
      team_entry_id,
      player_id,
      position,
      jersey_number,
      status,
      responded_at,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(15);
  const { data: callupRows } = leagueId === "platform" ? await callupQuery : await callupQuery.eq("league_id", leagueId);

  const playerIds = Array.from(new Set((callupRows || []).map((c: any) => c.player_id)));
  const { data: playerRows } = playerIds.length > 0
    ? await dbClient.from("players").select("id, display_name").in("id", playerIds)
    : { data: [] };
  const playerNameMap = new Map((playerRows || []).map((p: any) => [p.id, p.display_name]));

  const callups: GameCallupItem[] = (callupRows || []).map((c: any) => ({
    callup_id: c.id,
    game_id: c.game_id,
    team_entry_id: c.team_entry_id,
    team_name: teamNameMap.get(c.team_entry_id) || "Team",
    player_id: c.player_id,
    player_name: playerNameMap.get(c.player_id) || "Spare Player",
    player_position: c.position as "F" | "D" | "G",
    jersey_number: c.jersey_number,
    status: c.status as any,
    responded_at: c.responded_at,
    created_at: c.created_at,
  }));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GAME DAY ROSTER SUPPORT</p>
          <h1>Spare &amp; Goalie Pool</h1>
          <p>{data.league.name} · Emergency Sub Goaltenders &amp; Player Call-Ups</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href="/schedule">
            Schedule
          </Link>
          <Link className="button" href="/teams">
            Teams
          </Link>
        </div>
      </div>

      <SparePoolView
        spares={spares}
        callups={callups}
        userPlayers={userPlayers}
        upcomingGames={formattedGames}
        canManage={canManage}
        currentUserId={user?.id ?? null}
      />
    </>
  );
}

