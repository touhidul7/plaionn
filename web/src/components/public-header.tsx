import { getLeagueContext } from "@/lib/supabase/session";
import { PublicHeaderClient, type TickerGameItem } from "./public-header-client";

export async function PublicHeader() {
  const { supabase, league, user, canManage, leagueId } = await getLeagueContext();

  // Try to fetch public games with real scores
  let games: TickerGameItem[] = [];

  try {
    const { data: publicGamesData } = await supabase.rpc("get_public_schedule", {
      target_league: league.id,
    });

    if (publicGamesData && Array.isArray(publicGamesData) && publicGamesData.length > 0) {
      games = publicGamesData.slice(0, 10).map((g: any) => ({
        id: g.game_id || g.id,
        startsAt: new Date(g.starts_at).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) + " @ " + new Date(g.starts_at).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
        status: g.status,
        homeTeam: g.home_team_name ?? "Home",
        awayTeam: g.away_team_name ?? "Away",
        homeScore: g.home_score,
        awayScore: g.away_score,
        arena: g.venue_name ? `${g.venue_name} - ${g.rink_name ?? "Main"}` : "Arena",
      }));
    }
  } catch {
    // Graceful fallback to demo games if RPC not present
  }

  // If database games are empty or sparse, provide realistic league ticker games (WAHL sample from client notes)
  if (games.length === 0) {
    games = [
      {
        id: "demo-game-1",
        startsAt: "THU NOV 13 @ 9:45 PM",
        status: "final",
        awayTeam: "Thunder Puck",
        homeTeam: "SO25",
        awayScore: 4,
        homeScore: 3,
        arena: "Mr. Lube & Tires Arena - Red",
      },
      {
        id: "demo-game-2",
        startsAt: "THU NOV 13 @ 10:00 PM",
        status: "final",
        awayTeam: "Big Deals",
        homeTeam: "Richards",
        awayScore: 5,
        homeScore: 0,
        arena: "Mr. Lube & Tires Arena - Black",
      },
      {
        id: "demo-game-3",
        startsAt: "THU NOV 13 @ 10:45 PM",
        status: "final",
        awayTeam: "Black Bull Mud Dawgs",
        homeTeam: "Stingers",
        awayScore: 6,
        homeScore: 2,
        arena: "Mr. Lube & Tires Arena - Red",
      },
      {
        id: "demo-game-4",
        startsAt: "THU NOV 13 @ 11:00 PM",
        status: "final",
        awayTeam: "Morning Sherwoods",
        homeTeam: "Seal Team Sticks",
        awayScore: 3,
        homeScore: 2,
        arena: "Mr. Lube & Tires Arena - Black",
      },
      {
        id: "demo-game-5",
        startsAt: "FRI NOV 14 @ 8:30 PM",
        status: "scheduled",
        awayTeam: "Northline HC",
        homeTeam: "Metro Chiefs",
        awayScore: null,
        homeScore: null,
        arena: "Community Center Rink 1",
      },
    ];
  }

  return (
    <PublicHeaderClient
      leagueName={league.name}
      games={games}
      user={user}
      canManage={canManage}
      currentLeagueId={leagueId}
    />
  );
}
