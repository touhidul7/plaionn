import { getLeagueContext } from "@/lib/supabase/session";
import { PublicHeaderClient, type TickerGameItem } from "./public-header-client";
import { sanitizeVenueName } from "@/lib/sanitize";

export async function PublicHeader() {
  const { supabase, league, user, canManage } = await getLeagueContext();

  let games: TickerGameItem[] = [];

  try {
    const { data: publicGamesData } = await supabase.rpc("get_public_schedule", {
      target_league: league.id,
    });

    if (publicGamesData && Array.isArray(publicGamesData) && publicGamesData.length > 0) {
      games = publicGamesData.slice(0, 10).map((g: any) => ({
        id: g.game_id || g.id,
        startsAt:
          new Date(g.starts_at).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }) +
          " @ " +
          new Date(g.starts_at).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }),
        status: g.status,
        homeTeam: g.home_team_name ?? "Home",
        awayTeam: g.away_team_name ?? "Away",
        homeScore: g.home_score,
        awayScore: g.away_score,
        arena: g.venue_name
          ? `${sanitizeVenueName(g.venue_name)} - ${g.rink_name ?? "Rink 1"}`
          : "Metro Arena",
      }));
    } else {
      // Fallback query to games table
      const { data: rawGames } = await supabase
        .from("games")
        .select("id, starts_at, status, home_entry_id, away_entry_id, rink_id")
        .eq("league_id", league.id)
        .order("starts_at", { ascending: false })
        .limit(8);

      if (rawGames && rawGames.length > 0) {
        const { data: teamEntries } = await supabase
          .from("team_entries")
          .select("id, teams(name)")
          .eq("league_id", league.id);

        const entries = (teamEntries as any[]) || [];
        const getName = (id: string) =>
          entries.find((e) => e.id === id)?.teams?.name ?? "Team";

        games = rawGames.map((g) => ({
          id: g.id,
          startsAt:
            new Date(g.starts_at).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }) +
            " @ " +
            new Date(g.starts_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            }),
          status: g.status,
          homeTeam: getName(g.home_entry_id),
          awayTeam: getName(g.away_entry_id),
          homeScore: null,
          awayScore: null,
          arena: "Rink Arena",
        }));
      }
    }
  } catch {
    // Graceful fallback
  }

  return (
    <PublicHeaderClient
      leagueName={league.name}
      games={games}
      user={user}
      canManage={canManage}
    />
  );
}
