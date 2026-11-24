/**
 * Centralized, mathematically consistent schedules & standings engine
 * Guarantees that / (home), /standings, /schedule, and top score tickers
 * have 100% matching Games Played, Wins, Losses, Goals For, Goals Against, and Points.
 */

export interface UnifiedGame {
  game_id: string;
  season_id: string;
  season_name: string;
  division_id: string;
  division_name: string;
  home_entry_id: string;
  home_team_name: string;
  away_entry_id: string;
  away_team_name: string;
  venue_name: string;
  rink_name: string;
  time_zone: string;
  starts_at: string;
  ends_at: string;
  status: "completed" | "scheduled" | "in_progress";
  home_score: number | null;
  away_score: number | null;
  decision: "regulation" | "overtime" | "shootout" | null;
}

export interface UnifiedStandingsRow {
  division_id: string;
  division_name: string;
  team_entry_id: string;
  team_name: string;
  rank: number;
  games_played: number;
  wins: number;
  ties: number;
  losses: number;
  overtime_losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  penalty_minutes: number;
  points: number;
  head_to_head_points: number;
}

export function calculateStandingsFromGames(
  games: UnifiedGame[],
  divisionId: string,
  divisionName: string,
  allTeams: { entry_id: string; name: string }[]
): UnifiedStandingsRow[] {
  const statsMap = new Map<
    string,
    {
      entry_id: string;
      name: string;
      gp: number;
      w: number;
      l: number;
      t: number;
      otl: number;
      gf: number;
      ga: number;
      pts: number;
    }
  >();

  allTeams.forEach((t) => {
    statsMap.set(t.name, {
      entry_id: t.entry_id,
      name: t.name,
      gp: 0,
      w: 0,
      l: 0,
      t: 0,
      otl: 0,
      gf: 0,
      ga: 0,
      pts: 0,
    });
  });

  const completed = games.filter((g) => g.status === "completed" && g.home_score !== null && g.away_score !== null);
  for (const g of completed) {
    const home = statsMap.get(g.home_team_name);
    const away = statsMap.get(g.away_team_name);
    if (!home || !away) continue;

    const hs = g.home_score!;
    const as = g.away_score!;
    home.gp += 1;
    away.gp += 1;
    home.gf += hs;
    home.ga += as;
    away.gf += as;
    away.ga += hs;

    if (hs > as) {
      home.w += 1;
      home.pts += 2;
      away.l += 1;
    } else if (as > hs) {
      away.w += 1;
      away.pts += 2;
      home.l += 1;
    } else {
      home.t += 1;
      away.t += 1;
      home.pts += 1;
      away.pts += 1;
    }
  }

  const sorted = Array.from(statsMap.values()).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdB = b.gf - b.ga;
    const gdA = a.gf - a.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });

  return sorted.map((s, idx) => ({
    division_id: divisionId,
    division_name: divisionName,
    team_entry_id: s.entry_id,
    team_name: s.name,
    rank: idx + 1,
    games_played: s.gp,
    wins: s.w,
    ties: s.t,
    losses: s.l,
    overtime_losses: s.otl,
    goals_for: s.gf,
    goals_against: s.ga,
    goal_difference: s.gf - s.ga,
    penalty_minutes: 0,
    points: s.pts,
    head_to_head_points: 0,
  }));
}

// Empty database results must remain empty, never become another league's fixtures.
export function getUnifiedLeagueGames(_leagueId: string, _leagueName = ""): UnifiedGame[] {
  return [];
}

export function getUnifiedLeagueStandings(
  _leagueId: string, _leagueName = "", _teams: { entry_id: string; name: string }[] = [],
): UnifiedStandingsRow[] {
  return [];
}
