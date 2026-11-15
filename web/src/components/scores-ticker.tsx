import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

interface TickerGame {
  id: string;
  starts_at: string;
  status: string;
  home_entry_id: string;
  away_entry_id: string;
  rink_id: string | null;
}

export async function ScoresTicker() {
  const { supabase, league } = await getLeagueContext();

  const [gamesRes, teamsRes, rinksRes, venuesRes] = await Promise.all([
    supabase
      .from("games")
      .select("id, starts_at, status, home_entry_id, away_entry_id, rink_id")
      .eq("league_id", league.id)
      .order("starts_at", { ascending: false })
      .limit(8),
    supabase
      .from("team_entries")
      .select("id, teams(name)")
      .eq("league_id", league.id),
    supabase
      .from("rinks")
      .select("id, name, venue_id")
      .eq("league_id", league.id),
    supabase
      .from("venues")
      .select("id, name")
      .eq("league_id", league.id),
  ]);

  const games: TickerGame[] = gamesRes.data || [];
  if (games.length === 0) return null;

  const teamEntries = (teamsRes.data as any[]) || [];
  const rinks = (rinksRes.data as any[]) || [];
  const venues = (venuesRes.data as any[]) || [];

  const getTeamName = (entryId: string) => {
    const entry = teamEntries.find((t) => t.id === entryId);
    return entry?.teams?.name ?? "Team";
  };

  const getArenaName = (rinkId: string | null) => {
    if (!rinkId) return "Arena";
    const rink = rinks.find((r) => r.id === rinkId);
    const venue = venues.find((v) => v.id === rink?.venue_id);
    return rink ? `${venue?.name ?? ""} - ${rink.name}` : "Arena";
  };

  return (
    <div className="scores-ticker-wrap" aria-label="Recent Game Scores Ticker">
      <div className="scores-ticker-track">
        {games.map((g) => {
          const homeName = getTeamName(g.home_entry_id);
          const awayName = getTeamName(g.away_entry_id);
          const arenaName = getArenaName(g.rink_id);

          const isFinal = g.status === "completed";
          const isLive = g.status === "scheduled";

          return (
            <Link
              key={g.id}
              href={`/schedule/${g.id}/live`}
              className="scores-ticker-card"
              title={`View ${homeName} vs ${awayName} game details`}
            >
              <div className="scores-ticker-meta">
                <span>
                  {new Date(g.starts_at).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  @{" "}
                  {new Date(g.starts_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className={`scores-ticker-badge ${isFinal ? "final" : ""}`}>
                  {isFinal ? "FINAL" : isLive ? "SCHEDULED" : g.status.toUpperCase()}
                </span>
              </div>

              <div className="scores-ticker-matchup">
                <div className="scores-ticker-team">
                  <span className="ticker-team-name">{awayName}</span>
                  <span className="ticker-team-score">—</span>
                </div>
                <div className="scores-ticker-team">
                  <span className="ticker-team-name">{homeName}</span>
                  <span className="ticker-team-score">—</span>
                </div>
              </div>

              <div className="scores-ticker-arena">
                <small>{arenaName}</small>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
