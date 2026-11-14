import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { ShotsAndGoalieBoxscore } from "@/components/shots-and-goalie-boxscore";
import { GameStarsBanner } from "@/components/game-stars-banner";
import { GameVideoPackage } from "@/components/game-video-package";
import { getLeagueData } from "@/lib/league";
import { liveScoreboardSchema } from "@/lib/live-scoreboard";
import type { GameShotsSummary } from "@/lib/shots-schema";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function LiveGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) notFound();
  const { supabase, league } = await getLeagueContext();
  const game = await supabase
    .from("games")
    .select("id,status,home_entry_id,away_entry_id")
    .eq("id", gameId)
    .eq("league_id", league.id)
    .eq("status", "scheduled")
    .maybeSingle();

  if (game.error)
    return (
      <section className="panel">
        <h1>Live scoreboard unavailable</h1>
        <p>Could not load this scheduled game.</p>
      </section>
    );
  if (!game.data) notFound();
  const fixture = game.data;
  const [boardResult, shotsResult, videoResult, storiesResult] = await Promise.all([
    supabase.rpc("get_live_scoreboard", { target_game: gameId }),
    supabase.rpc("get_game_shots_summary", { target_game: gameId }),
    supabase.rpc("get_game_video_package", { target_game: gameId }),
    supabase.rpc("get_game_story_reel", { target_game: gameId }),
  ]);

  const board = liveScoreboardSchema.safeParse(boardResult.data);
  if (boardResult.error || !board.success)
    return (
      <section className="panel">
        <h1>Live scoreboard unavailable</h1>
        <p>Apply the live-score migration and try again.</p>
        <Link className="button" href="/schedule">
          Back to schedule
        </Link>
      </section>
    );

  const leagueData = await getLeagueData();
  const homeName =
    leagueData.teams.find((team) => team.entry_id === fixture.home_entry_id)
      ?.name ?? "Home";
  const awayName =
    leagueData.teams.find((team) => team.entry_id === fixture.away_entry_id)
      ?.name ?? "Away";

  const shotsSummary: GameShotsSummary = (shotsResult.data as GameShotsSummary) || {
    game_id: gameId,
    home_entry_id: fixture.home_entry_id,
    away_entry_id: fixture.away_entry_id,
    home_name: homeName,
    away_name: awayName,
    period_shots: [],
    goalies: [],
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{league.name}</p>
          <h1>Live scoreboard</h1>
          <p>For league members · Automatically refreshed from saved game events.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href={`/schedule/${gameId}/lineup`}>
            Lineup Board
          </Link>
          <Link className="button" href={`/schedule/${gameId}/rsvp`}>
            Attendance &amp; RSVP
          </Link>
          <Link className="button" href="/schedule">
            Schedules &amp; Scores
          </Link>
        </div>
      </div>

      {/* Official Three Stars of the Game Banner */}
      <GameStarsBanner gameId={gameId} />

      <LiveScoreboard
        initial={board.data}
        homeName={homeName}
        awayName={awayName}
      />

      {/* Phase 3 Broadcast Video & Highlight Clips */}
      {(videoResult?.data || storiesResult?.data) && (
        <GameVideoPackage
          streams={(videoResult?.data as any)?.streams || []}
          highlights={(videoResult?.data as any)?.highlights || []}
          stories={(storiesResult?.data as any) || []}
        />
      )}

      <div className="mt-6">
        <ShotsAndGoalieBoxscore summary={shotsSummary} canScore={false} />
      </div>
    </>
  );
}
