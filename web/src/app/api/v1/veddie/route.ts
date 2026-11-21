import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Standard CORS headers allowing Veddie Hockey frontend/backend to query
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-veddie-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    // 1. Optional API Key verification
    const expectedKey = process.env.PLAIONN_VEDDIE_API_KEY;
    if (expectedKey) {
      const authHeader = req.headers.get("authorization");
      const customHeader = req.headers.get("x-veddie-api-key");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

      if (bearerToken !== expectedKey && customHeader !== expectedKey) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing API key" },
          { status: 401, headers: corsHeaders }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const targetLeague = searchParams.get("leagueId") || null;

    const supabase = await createSupabaseServerClient(false);

    // 2. Fetch league overview (seasons, divisions, teams)
    const { data: overviewData, error: overviewError } = await supabase.rpc(
      "get_public_league_overview",
      targetLeague ? { target_league: targetLeague } : {}
    );

    if (overviewError) {
      console.error("[Plaionn API] Overview error:", overviewError);
      return NextResponse.json(
        { error: "Failed to load league overview from database", details: overviewError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    const leaguesList = Array.isArray(overviewData) ? overviewData : overviewData ? [overviewData] : [];

    // 3. For each season in each league, retrieve standings
    const formattedLeagues = [];

    for (const l of leaguesList) {
      const seasons = Array.isArray(l.seasons) ? l.seasons : [];
      const divisions = Array.isArray(l.divisions) ? l.divisions : [];
      const leagueDivisionsData = [];

      for (const season of seasons) {
        const { data: standingsRows, error: standingsError } = await supabase.rpc(
          "get_season_standings",
          { target_season: season.id }
        );

        if (standingsError || !Array.isArray(standingsRows)) {
          continue;
        }

        // Group standings by division
        const divMap = new Map<string, any[]>();
        for (const row of standingsRows) {
          const divId = row.division_id;
          if (!divMap.has(divId)) {
            divMap.set(divId, []);
          }
          divMap.get(divId)!.push(row);
        }

        for (const [divId, rows] of divMap.entries()) {
          const divInfo = divisions.find((d: any) => d.id === divId);
          const divName = divInfo?.name || rows[0]?.division_name || "Division";
          const totalTeams = rows.length;

          // Top 25% Rule: rounded up (a 10-team league sends 3)
          const qualifierQuota = Math.ceil(totalTeams / 4);

          const standings = rows.map((team: any, index: number) => {
            const teamRank = Number(team.rank || index + 1);
            let qualificationStatus: string | null = null;

            if (teamRank === 1) {
              qualificationStatus = "Verified qualifier"; // Leader / Auto-bid candidate
            } else if (teamRank <= qualifierQuota) {
              qualificationStatus = "Inside the line"; // Top quarter
            }

            return {
              rank: teamRank,
              teamId: team.team_entry_id,
              teamName: team.team_name,
              teamSlug: team.team_name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
              gamesPlayed: Number(team.games_played || 0),
              wins: Number(team.wins || 0),
              losses: Number(team.losses || 0),
              ties: Number(team.ties || 0),
              overtimeLosses: Number(team.overtime_losses || 0),
              points: Number(team.points || 0),
              goalsFor: Number(team.goals_for || 0),
              goalsAgainst: Number(team.goals_against || 0),
              goalDifference: Number(team.goal_difference || 0),
              qualificationStatus,
            };
          });

          leagueDivisionsData.push({
            seasonId: season.id,
            seasonName: season.name,
            divisionId: divId,
            divisionName: divName,
            totalTeams,
            qualifierQuota,
            standings,
          });
        }
      }

      formattedLeagues.push({
        leagueId: l.league_id,
        leagueName: l.league_name,
        source: "Plaionn Sports Group",
        divisions: leagueDivisionsData,
      });
    }

    // 4. Fetch Cross-League Network Rankings
    let crossLeagueRankings: any[] = [];
    try {
      const { data: rankData } = await supabase.rpc("get_network_cross_league_rankings", {});
      if (Array.isArray(rankData)) {
        crossLeagueRankings = rankData.map((r: any) => ({
          rank: Number(r.network_rank),
          teamId: r.team_id,
          teamName: r.team_name,
          teamSlug: r.team_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
          leagueId: r.league_id,
          leagueName: r.league_name,
          skillTier: r.skill_tier,
          ratingScore: Number(r.rating_score || 1000),
          gamesPlayed: Number(r.games_played || 0),
          goalDifferential: Number(r.goal_differential || 0),
        }));
      }
    } catch (e) {
      console.warn("[Plaionn API] Cross-league rankings RPC skipped or unavailable:", e);
    }

    return NextResponse.json(
      {
        success: true,
        provider: "Plaionn Sports Group",
        syncedAt: new Date().toISOString(),
        leagues: formattedLeagues,
        crossLeagueRankings,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[Plaionn API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error?.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
