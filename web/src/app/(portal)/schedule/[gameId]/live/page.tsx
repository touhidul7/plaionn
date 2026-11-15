import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { ShotsAndGoalieBoxscore } from "@/components/shots-and-goalie-boxscore";
import { GameStarsBanner } from "@/components/game-stars-banner";
import { GameVideoPackage } from "@/components/game-video-package";
import { getLeagueData } from "@/lib/league";
import { liveScoreboardSchema, type LiveScoreboardData } from "@/lib/live-scoreboard";
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

  // Load the game record (any status: scheduled, completed, draft)
  const game = await supabase
    .from("games")
    .select("id, status, starts_at, ends_at, home_entry_id, away_entry_id, rink_id")
    .eq("id", gameId)
    .eq("league_id", league.id)
    .maybeSingle();

  if (game.error || !game.data) notFound();
  const fixture = game.data;

  // Load team & league metadata
  const leagueData = await getLeagueData();
  const homeTeam = leagueData.teams.find((team) => team.entry_id === fixture.home_entry_id);
  const awayTeam = leagueData.teams.find((team) => team.entry_id === fixture.away_entry_id);
  const homeName = homeTeam?.name ?? "Home Team";
  const awayName = awayTeam?.name ?? "Away Team";

  // Arena & Player information from database
  const [playersRes, rinkRes] = await Promise.all([
    supabase.from("players").select("id, display_name").eq("league_id", league.id),
    fixture.rink_id
      ? supabase.from("rinks").select("id, name, venues(name)").eq("id", fixture.rink_id).maybeSingle()
      : { data: null, error: null },
  ]);

  const allPlayers: { id: string; display_name: string }[] = (playersRes.data as any[]) || [];
  const rinkData = rinkRes.data as any;
  const arenaLocation = rinkData ? `${rinkData.venues?.name ?? "Arena"} · ${rinkData.name}` : "Main Arena Rink";

  // Load raw game events for linescore, scoring summary, and penalties
  const { data: rawEvents } = await supabase
    .from("game_events")
    .select("id, period, clock_seconds, event_type, team_entry_id, player_id, assist1_player_id, assist2_player_id, penalty_minutes, voided, created_at")
    .eq("game_id", gameId)
    .eq("voided", false)
    .order("period", { ascending: true })
    .order("clock_seconds", { ascending: false });

  const events = rawEvents || [];

  // Period-by-period goal counts
  const periods = [1, 2, 3];
  const homeP1 = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.home_entry_id && e.period === 1).length;
  const homeP2 = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.home_entry_id && e.period === 2).length;
  const homeP3 = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.home_entry_id && e.period === 3).length;
  const homeOT = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.home_entry_id && e.period > 3).length;
  const homeTotal = homeP1 + homeP2 + homeP3 + homeOT;

  const awayP1 = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.away_entry_id && e.period === 1).length;
  const awayP2 = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.away_entry_id && e.period === 2).length;
  const awayP3 = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.away_entry_id && e.period === 3).length;
  const awayOT = events.filter((e) => e.event_type === "goal" && e.team_entry_id === fixture.away_entry_id && e.period > 3).length;
  const awayTotal = awayP1 + awayP2 + awayP3 + awayOT;

  const hasOT = homeOT > 0 || awayOT > 0;

  // Build bulletproof live board data
  const [boardResult, shotsResult, videoResult, storiesResult] = await Promise.all([
    supabase.rpc("get_live_scoreboard", { target_game: gameId }),
    supabase.rpc("get_game_shots_summary", { target_game: gameId }),
    supabase.rpc("get_game_video_package", { target_game: gameId }),
    supabase.rpc("get_game_story_reel", { target_game: gameId }),
  ]);

  const parsedBoard = liveScoreboardSchema.safeParse(boardResult?.data);
  const boardData: LiveScoreboardData = parsedBoard.success ? parsedBoard.data : {
    game_id: gameId,
    home_entry_id: fixture.home_entry_id,
    away_entry_id: fixture.away_entry_id,
    home_score: homeTotal,
    away_score: awayTotal,
    events: events.map((e) => ({
      id: e.id,
      event_kind: e.event_type as "goal" | "penalty",
      team_entry_id: e.team_entry_id,
      period: e.period,
      clock_seconds_remaining: e.clock_seconds,
      penalty_minutes: e.penalty_minutes,
      recorded_at: e.created_at,
    })),
    snapshot_at: new Date().toISOString(),
  };

  const shotsSummary: GameShotsSummary = (shotsResult?.data as GameShotsSummary) || {
    game_id: gameId,
    home_entry_id: fixture.home_entry_id,
    away_entry_id: fixture.away_entry_id,
    home_name: homeName,
    away_name: awayName,
    period_shots: [],
    goalies: [],
  };

  const goals = events.filter((e) => e.event_type === "goal");
  const penalties = events.filter((e) => e.event_type === "penalty");

  return (
    <>
      {/* 1. Header & Navigation Controls */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">{league.name} · OFFICIAL GAME CENTRE</p>
          <h1>Game Details &amp; Boxscore</h1>
          <p>{arenaLocation} · {new Date(fixture.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href={`/schedule/${gameId}/lineup`}>
            Lineups
          </Link>
          <Link className="button" href={`/schedule/${gameId}/rsvp`}>
            Attendance RSVP
          </Link>
          <Link className="button" href="/schedule">
            Schedules &amp; Scores
          </Link>
        </div>
      </div>

      {/* 2. theScore-Style Hero Matchup Banner */}
      <section className="panel" style={{ marginBottom: "24px", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
          <div>
            <span className="badge" style={{ background: fixture.status === "completed" ? "#1a382b" : "#1e3a8a", color: fixture.status === "completed" ? "var(--lime)" : "#93c5fd", fontWeight: 700, textTransform: "uppercase" }}>
              {fixture.status === "completed" ? "FINAL" : fixture.status.toUpperCase()}
            </span>
            <span style={{ marginLeft: "10px", fontSize: "13px", color: "var(--muted)" }}>
              {arenaLocation}
            </span>
          </div>
          <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 600 }}>
            {new Date(fixture.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "24px", textAlign: "center" }}>
          {/* Away Team */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <Link href={`/teams/${fixture.away_entry_id}`} className="text-link" style={{ fontSize: "1.4rem", fontWeight: 800 }}>
              {awayName}
            </Link>
            <span className="badge" style={{ fontSize: "11px" }}>Away</span>
          </div>

          {/* Running / Final Score */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <div style={{ fontSize: "3rem", fontWeight: 900, letterSpacing: "4px", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {awayTotal} – {homeTotal}
            </div>
            <small style={{ color: "var(--muted)", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
              {fixture.status === "completed" ? "Final Score" : "Live Score"}
            </small>
          </div>

          {/* Home Team */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <Link href={`/teams/${fixture.home_entry_id}`} className="text-link" style={{ fontSize: "1.4rem", fontWeight: 800 }}>
              {homeName}
            </Link>
            <span className="badge" style={{ fontSize: "11px" }}>Home</span>
          </div>
        </div>
      </section>

      {/* 3. Linescore Boxscore Table (theScore style) */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Linescore</h2>
          <span>Period-by-period scoring</span>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ textAlign: "center" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left" }}>Team</th>
                <th scope="col">1st</th>
                <th scope="col">2nd</th>
                <th scope="col">3rd</th>
                {hasOT && <th scope="col">OT</th>}
                <th scope="col" style={{ color: "var(--lime)", fontWeight: 800 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: "left", fontWeight: 700 }}>
                  <Link href={`/teams/${fixture.away_entry_id}`} className="text-link">
                    {awayName}
                  </Link>
                </td>
                <td>{awayP1}</td>
                <td>{awayP2}</td>
                <td>{awayP3}</td>
                {hasOT && <td>{awayOT}</td>}
                <td><strong style={{ color: "var(--lime)", fontSize: "1.1rem" }}>{awayTotal}</strong></td>
              </tr>
              <tr>
                <td style={{ textAlign: "left", fontWeight: 700 }}>
                  <Link href={`/teams/${fixture.home_entry_id}`} className="text-link">
                    {homeName}
                  </Link>
                </td>
                <td>{homeP1}</td>
                <td>{homeP2}</td>
                <td>{homeP3}</td>
                {hasOT && <td>{homeOT}</td>}
                <td><strong style={{ color: "var(--lime)", fontSize: "1.1rem" }}>{homeTotal}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Official Three Stars of the Game Banner */}
      <GameStarsBanner gameId={gameId} />

      {/* 5. Live Scoreboard Polling & Event Feed Component */}
      <LiveScoreboard
        initial={boardData}
        homeName={homeName}
        awayName={awayName}
      />

      {/* 6. Scoring Summary */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Scoring Summary</h2>
          <span className="badge">{goals.length} Goals Recorded</span>
        </div>
        {goals.length === 0 ? (
          <p className="empty">No goals recorded in this game yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Team</th>
                  <th>Goal Scorer</th>
                  <th>Assists</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => {
                  const teamTitle = g.team_entry_id === fixture.home_entry_id ? homeName : awayName;
                  const scorer = allPlayers.find((p) => p.id === g.player_id);
                  const a1 = allPlayers.find((p) => p.id === g.assist1_player_id);
                  const a2 = allPlayers.find((p) => p.id === g.assist2_player_id);
                  const assistText = [a1?.display_name, a2?.display_name].filter(Boolean).join(", ") || "Unassisted";

                  return (
                    <tr key={g.id}>
                      <td>Period {g.period}</td>
                      <td>
                        {Math.floor((g.clock_seconds || 0) / 60)}:
                        {((g.clock_seconds || 0) % 60).toString().padStart(2, "0")}
                      </td>
                      <td><strong>{teamTitle}</strong></td>
                      <td>
                        {scorer ? (
                          <Link href={`/players/${scorer.id}`} className="text-link" style={{ fontWeight: 700 }}>
                            {scorer.display_name} ⚽
                          </Link>
                        ) : (
                          <span>Goal</span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{assistText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 7. Penalties Summary */}
      {penalties.length > 0 && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="section-heading" style={{ margin: "0 0 16px" }}>
            <h2 style={{ margin: 0 }}>Penalties Summary</h2>
            <span className="badge warning">{penalties.length} Infractions</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Minutes</th>
                </tr>
              </thead>
              <tbody>
                {penalties.map((pen) => {
                  const teamTitle = pen.team_entry_id === fixture.home_entry_id ? homeName : awayName;
                  const penalizedPlayer = allPlayers.find((p) => p.id === pen.player_id);

                  return (
                    <tr key={pen.id}>
                      <td>Period {pen.period}</td>
                      <td>
                        {Math.floor((pen.clock_seconds || 0) / 60)}:
                        {((pen.clock_seconds || 0) % 60).toString().padStart(2, "0")}
                      </td>
                      <td>{teamTitle}</td>
                      <td>
                        {penalizedPlayer ? (
                          <Link href={`/players/${penalizedPlayer.id}`} className="text-link">
                            {penalizedPlayer.display_name}
                          </Link>
                        ) : (
                          <span>Player</span>
                        )}
                      </td>
                      <td><span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>{pen.penalty_minutes} MIN</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 8. Broadcast Video & Story Reel Highlights */}
      <GameVideoPackage
        streams={(videoResult?.data as any)?.streams || []}
        highlights={(videoResult?.data as any)?.highlights || []}
        stories={(storiesResult?.data as any) || []}
      />

      {/* 9. Shots & Goalie Performance */}
      <div className="mt-6">
        <ShotsAndGoalieBoxscore summary={shotsSummary} canScore={false} />
      </div>
    </>
  );
}
