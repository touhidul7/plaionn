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

// 1. League 2: Wave Adult Hockey League (WAHL)
const WAHL_GAMES: UnifiedGame[] = [
  {
    game_id: "g-wahl-1",
    season_id: "60000000-0000-4000-8000-000000000032",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000033",
    division_name: "Adult Rec Division A",
    home_entry_id: "60000000-0000-4000-8000-000000000035",
    home_team_name: "Harbour Wolves",
    away_entry_id: "60000000-0000-4000-8000-000000000037",
    away_team_name: "Wave Breakers",
    venue_name: "Wave Arena",
    rink_name: "Rink 1 - Red",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 4 * 86400000 + 3600000).toISOString(),
    status: "completed",
    home_score: 5,
    away_score: 3,
    decision: "regulation",
  },
  {
    game_id: "g-wahl-2",
    season_id: "60000000-0000-4000-8000-000000000032",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000033",
    division_name: "Adult Rec Division A",
    home_entry_id: "60000000-0000-4000-8000-000000000039",
    home_team_name: "Coastal Frost",
    away_entry_id: "60000000-0000-4000-8000-000000000041",
    away_team_name: "Metro Blades",
    venue_name: "Wave Arena",
    rink_name: "Rink 2 - Black",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 3 * 86400000 + 3600000).toISOString(),
    status: "completed",
    home_score: 4,
    away_score: 2,
    decision: "regulation",
  },
  {
    game_id: "g-wahl-3",
    season_id: "60000000-0000-4000-8000-000000000032",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000033",
    division_name: "Adult Rec Division A",
    home_entry_id: "60000000-0000-4000-8000-000000000035",
    home_team_name: "Harbour Wolves",
    away_entry_id: "60000000-0000-4000-8000-000000000039",
    away_team_name: "Coastal Frost",
    venue_name: "Wave Arena",
    rink_name: "Rink 1 - Red",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(),
    status: "completed",
    home_score: 4,
    away_score: 2,
    decision: "regulation",
  },
  {
    game_id: "g-wahl-4",
    season_id: "60000000-0000-4000-8000-000000000032",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000033",
    division_name: "Adult Rec Division A",
    home_entry_id: "60000000-0000-4000-8000-000000000037",
    home_team_name: "Wave Breakers",
    away_entry_id: "60000000-0000-4000-8000-000000000041",
    away_team_name: "Metro Blades",
    venue_name: "Wave Arena",
    rink_name: "Rink 2 - Black",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 1 * 86400000 + 3600000).toISOString(),
    status: "completed",
    home_score: 3,
    away_score: 1,
    decision: "regulation",
  },
  {
    game_id: "g-wahl-5",
    season_id: "60000000-0000-4000-8000-000000000032",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000033",
    division_name: "Adult Rec Division A",
    home_entry_id: "60000000-0000-4000-8000-000000000035",
    home_team_name: "Harbour Wolves",
    away_entry_id: "60000000-0000-4000-8000-000000000041",
    away_team_name: "Metro Blades",
    venue_name: "Wave Arena",
    rink_name: "Rink 1 - Red",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() + 1 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 1 * 86400000 + 3600000).toISOString(),
    status: "scheduled",
    home_score: null,
    away_score: null,
    decision: null,
  },
  {
    game_id: "g-wahl-6",
    season_id: "60000000-0000-4000-8000-000000000032",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000033",
    division_name: "Adult Rec Division A",
    home_entry_id: "60000000-0000-4000-8000-000000000037",
    home_team_name: "Wave Breakers",
    away_entry_id: "60000000-0000-4000-8000-000000000039",
    away_team_name: "Coastal Frost",
    venue_name: "Wave Arena",
    rink_name: "Rink 2 - Black",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(),
    status: "scheduled",
    home_score: null,
    away_score: null,
    decision: null,
  },
];

// 2. League 1: Bangladesh Hockey League (BHL)
const BHL_GAMES: UnifiedGame[] = [
  {
    game_id: "g-bhl-1",
    season_id: "60000000-0000-4000-8000-000000000002",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000003",
    division_name: "Premier Division",
    home_entry_id: "60000000-0000-4000-8000-000000000021",
    home_team_name: "Dhaka Gladiators",
    away_entry_id: "60000000-0000-4000-8000-000000000022",
    away_team_name: "Chittagong Warriors",
    venue_name: "National Arena",
    rink_name: "Rink 1",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 3 * 86400000 + 3600000).toISOString(),
    status: "completed",
    home_score: 4,
    away_score: 2,
    decision: "regulation",
  },
  {
    game_id: "g-bhl-2",
    season_id: "60000000-0000-4000-8000-000000000002",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000003",
    division_name: "Premier Division",
    home_entry_id: "60000000-0000-4000-8000-000000000023",
    home_team_name: "Sylhet Strikers",
    away_entry_id: "60000000-0000-4000-8000-000000000024",
    away_team_name: "Rajshahi Rangers",
    venue_name: "National Arena",
    rink_name: "Rink 2",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    ends_at: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(),
    status: "completed",
    home_score: 3,
    away_score: 1,
    decision: "regulation",
  },
  {
    game_id: "g-bhl-3",
    season_id: "60000000-0000-4000-8000-000000000002",
    season_name: "Winter 2026",
    division_id: "60000000-0000-4000-8000-000000000003",
    division_name: "Premier Division",
    home_entry_id: "60000000-0000-4000-8000-000000000021",
    home_team_name: "Dhaka Gladiators",
    away_entry_id: "60000000-0000-4000-8000-000000000023",
    away_team_name: "Sylhet Strikers",
    venue_name: "National Arena",
    rink_name: "Rink 1",
    time_zone: "America/Toronto",
    starts_at: new Date(Date.now() + 1 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 1 * 86400000 + 3600000).toISOString(),
    status: "scheduled",
    home_score: null,
    away_score: null,
    decision: null,
  },
];

// Helper to calculate verified standings directly from fixtures
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

export function getUnifiedLeagueGames(leagueId: string, leagueName: string = ""): UnifiedGame[] {
  if (leagueId === "60000000-0000-4000-8000-000000000003" || leagueName.includes("Wave") || leagueName.includes("WAHL")) {
    return WAHL_GAMES;
  }
  if (leagueId === "60000000-0000-4000-8000-000000000001" || leagueName.includes("Bangladesh") || leagueName.includes("BHL")) {
    return BHL_GAMES;
  }
  return WAHL_GAMES;
}

export function getUnifiedLeagueStandings(
  leagueId: string,
  leagueName: string = "",
  teams: { entry_id: string; name: string }[] = []
): UnifiedStandingsRow[] {
  if (leagueId === "60000000-0000-4000-8000-000000000003" || leagueName.includes("Wave") || leagueName.includes("WAHL")) {
    const defaultTeams = [
      { entry_id: "60000000-0000-4000-8000-000000000035", name: "Harbour Wolves" },
      { entry_id: "60000000-0000-4000-8000-000000000037", name: "Wave Breakers" },
      { entry_id: "60000000-0000-4000-8000-000000000039", name: "Coastal Frost" },
      { entry_id: "60000000-0000-4000-8000-000000000041", name: "Metro Blades" },
    ];
    return calculateStandingsFromGames(
      WAHL_GAMES,
      "60000000-0000-4000-8000-000000000033",
      "Adult Rec Division A",
      teams.length > 0 ? teams : defaultTeams
    );
  }

  const defaultBhlTeams = [
    { entry_id: "60000000-0000-4000-8000-000000000021", name: "Dhaka Gladiators" },
    { entry_id: "60000000-0000-4000-8000-000000000022", name: "Chittagong Warriors" },
    { entry_id: "60000000-0000-4000-8000-000000000023", name: "Sylhet Strikers" },
    { entry_id: "60000000-0000-4000-8000-000000000024", name: "Rajshahi Rangers" },
  ];
  return calculateStandingsFromGames(
    BHL_GAMES,
    "60000000-0000-4000-8000-000000000003",
    "Premier Division",
    teams.length > 0 ? teams : defaultBhlTeams
  );
}
