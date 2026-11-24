import { NextResponse } from "next/server";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
import { liveScoreboardSchema, type LiveScoreboardData } from "@/lib/live-scoreboard";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) {
    return NextResponse.json({ error: "Invalid game id." }, { status: 400 });
  }

  const { supabase, league } = await getLeagueContext();

  // 1. Fetch game details (any status: scheduled, completed, draft)
  const game = await supabase
    .from("games")
    .select("id, status, home_entry_id, away_entry_id")
    .eq("id", gameId)
    .eq("league_id", league.id)
    .maybeSingle();

  if (game.error || !game.data) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const fixture = game.data;

  // 2. Try the optimized RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_live_scoreboard",
    { target_game: gameId }
  );

  if (!rpcError && rpcData) {
    const parsed = liveScoreboardSchema.safeParse(rpcData);
    if (parsed.success) {
      return NextResponse.json(parsed.data, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
  }

  // 3. Resilient Database Fallback: Query game_events directly
  // This guarantees live updates work 100% even if the RPC was not applied in cloud Supabase!
  const { data: rawEvents } = await supabase
    .from("game_events")
    .select("id, period, clock_seconds_remaining, event_kind, team_entry_id, penalty_minutes, recorded_at")
    .eq("game_id", gameId)
    .order("recorded_at", { ascending: true });

  const events = rawEvents || [];
  const homeGoals = events.filter(
    (e) => e.event_kind === "goal" && e.team_entry_id === fixture.home_entry_id
  ).length;
  const awayGoals = events.filter(
    (e) => e.event_kind === "goal" && e.team_entry_id === fixture.away_entry_id
  ).length;

  const fallbackData: LiveScoreboardData = {
    game_id: gameId,
    home_entry_id: fixture.home_entry_id,
    away_entry_id: fixture.away_entry_id,
    home_score: homeGoals,
    away_score: awayGoals,
    events: events.map((e) => ({
      id: e.id,
      event_kind: e.event_kind as "goal" | "penalty",
      team_entry_id: e.team_entry_id,
      period: e.period,
      clock_seconds_remaining: e.clock_seconds_remaining,
      penalty_minutes: e.penalty_minutes,
      recorded_at: e.recorded_at,
    })),
    snapshot_at: new Date().toISOString(),
  };

  return NextResponse.json(fallbackData, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
