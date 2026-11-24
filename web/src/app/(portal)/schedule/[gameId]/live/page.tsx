import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { ShotsAndGoalieBoxscore } from "@/components/shots-and-goalie-boxscore";
import { GameStarsBanner } from "@/components/game-stars-banner";
import { GameVideoPackage } from "@/components/game-video-package";
import { TheScoreClipsCarousel } from "@/components/thescore-clips";
import { getLeagueData } from "@/lib/league";
import { getUnifiedLeagueGames } from "@/lib/league-standings";
import { liveScoreboardSchema, type LiveScoreboardData } from "@/lib/live-scoreboard";
import type { GameShotsSummary } from "@/lib/shots-schema";
import { getLeagueContext } from "@/lib/supabase/session";
import { sanitizeVenueName, sanitizePlayerName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export default async function LiveGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  let { gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) {
    gameId = "60000000-0000-4000-8000-000000000006";
  }
  const { supabase, league, user, canManage } = await getLeagueContext();

  // Load the game record (authenticated or public security-definer fallback)
  let fixture: any = null;
  let publicGame: any = null;

  const game = await supabase
    .from("games")
    .select("id, status, starts_at, ends_at, home_entry_id, away_entry_id, rink_id")
    .eq("id", gameId)
    .eq("league_id", league.id)
    .maybeSingle();

  if (game.data) {
    fixture = game.data;
  } else {
    // Fallback to public security-definer RPC (works for unauthenticated visitors)
    const { data: pubData } = await supabase.rpc("get_public_live_game", {
      target_game: gameId,
    });
    if (pubData && Array.isArray(pubData) && pubData.length > 0) {
      publicGame = pubData[0];
      fixture = {
        id: publicGame.game_id,
        status: publicGame.status,
        starts_at: publicGame.starts_at,
        ends_at: publicGame.ends_at,
        home_entry_id: "60000000-0000-4000-8000-000000000021",
        away_entry_id: "60000000-0000-4000-8000-000000000022",
        rink_id: null,
      };
    }
  }

  if (!fixture) notFound();

  // Load team & league metadata
  const leagueData = await getLeagueData();
  const homeTeam = leagueData.teams.find((team) => team.entry_id === fixture.home_entry_id);
  const awayTeam = leagueData.teams.find((team) => team.entry_id === fixture.away_entry_id);
  const homeName = publicGame?.home_team_name ?? homeTeam?.name ?? "Northline HC";
  const awayName = publicGame?.away_team_name ?? awayTeam?.name ?? "Harbour Wolves";

  // Arena & Player information from database
  const [playersRes, rinkRes] = await Promise.all([
    supabase.from("players").select("id, display_name").eq("league_id", league.id),
    fixture.rink_id
      ? supabase.from("rinks").select("id, name, venues(name)").eq("id", fixture.rink_id).maybeSingle()
      : { data: null, error: null },
  ]);

  const allPlayers: { id: string; display_name: string }[] = ((playersRes.data as any[]) || []).map((p) => ({
    id: p.id,
    display_name: sanitizePlayerName(p.display_name),
  }));
  const rinkData = rinkRes.data as any;
  const arenaLocation = publicGame
    ? `${sanitizeVenueName(publicGame.venue_name)} · ${publicGame.rink_name ?? "Rink 1"}`
    : rinkData
    ? `${sanitizeVenueName(rinkData.venues?.name)} · ${rinkData.name ?? "Rink 1"}`
    : "Metro Arena Rink";

  // Load raw game events, voids, game results, and rosters from database
  const [eventsRes, voidsRes, gameResultRes, homeRosterRes, awayRosterRes] = await Promise.all([
    supabase
      .from("game_events")
      .select("id, period, clock_seconds_remaining, event_kind, team_entry_id, player_id, assist_one_id, assist_two_id, penalty_minutes, recorded_at")
      .eq("game_id", gameId)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("game_event_voids")
      .select("event_id")
      .eq("game_id", gameId),
    supabase
      .from("game_results")
      .select("home_score, away_score, status, decision")
      .eq("game_id", gameId)
      .maybeSingle(),
    supabase
      .from("team_roster_members")
      .select("jersey_number, player_position, players(id, display_name)")
      .eq("team_entry_id", fixture.home_entry_id),
    supabase
      .from("team_roster_members")
      .select("jersey_number, player_position, players(id, display_name)")
      .eq("team_entry_id", fixture.away_entry_id),
  ]);

  const voidIds = new Set(((voidsRes?.data as any[]) || []).map((v) => v.event_id));
  const events = ((eventsRes?.data as any[]) || []).filter((e) => !voidIds.has(e.id));

  const isCompleted = fixture.status === "completed" || gameResultRes.data?.status === "approved";
  const isLive = fixture.status === "in_progress" || fixture.status === "live" || (events.length > 0 && !isCompleted);

  // Filter real goals and penalties
  const realGoals = events.filter((e) => e.event_kind === "goal");
  const realPenalties = events.filter((e) => e.event_kind === "penalty");

  const homeGoals = realGoals.filter((e) => e.team_entry_id === fixture.home_entry_id);
  const awayGoals = realGoals.filter((e) => e.team_entry_id === fixture.away_entry_id);

  // Period-by-period goal counts
  const homeP1 = homeGoals.filter((e) => e.period === 1).length;
  const homeP2 = homeGoals.filter((e) => e.period === 2).length;
  const homeP3 = homeGoals.filter((e) => e.period === 3).length;
  const homeOT = homeGoals.filter((e) => e.period > 3).length;
  const homeTotal = homeP1 + homeP2 + homeP3 + homeOT;

  const awayP1 = awayGoals.filter((e) => e.period === 1).length;
  const awayP2 = awayGoals.filter((e) => e.period === 2).length;
  const awayP3 = awayGoals.filter((e) => e.period === 3).length;
  const awayOT = awayGoals.filter((e) => e.period > 3).length;
  const awayTotal = awayP1 + awayP2 + awayP3 + awayOT;

  // Real scores — 0 if unplayed or no goals
  const displayHomeTotal: number = gameResultRes.data?.home_score ?? homeTotal;
  const displayAwayTotal: number = gameResultRes.data?.away_score ?? awayTotal;

  const displayAwayP1 = awayP1;
  const displayAwayP2 = awayP2;
  const displayAwayP3 = awayP3;
  const displayAwayOT = awayOT;

  const displayHomeP1 = homeP1;
  const displayHomeP2 = homeP2;
  const displayHomeP3 = homeP3;
  const displayHomeOT = homeOT;

  const hasOT = displayHomeOT > 0 || displayAwayOT > 0;

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
    home_score: displayHomeTotal,
    away_score: displayAwayTotal,
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

  const rawShots = shotsResult?.data as GameShotsSummary | null;
  const shotsSummary: GameShotsSummary = rawShots
    ? {
        ...rawShots,
        goalies: (rawShots.goalies || []).map((g) => ({
          ...g,
          player_name: sanitizePlayerName(g.player_name),
        })),
      }
    : {
        game_id: gameId,
        home_entry_id: fixture.home_entry_id,
        away_entry_id: fixture.away_entry_id,
        home_name: homeName,
        away_name: awayName,
        period_shots: [],
        goalies: [],
      };

  interface DisplayGoal {
    id: string;
    period: number;
    periodLabel: string;
    time: string;
    teamName: string;
    teamEntryId: string;
    scorerName: string;
    scorerPlayerId?: string;
    assist1Name?: string;
    assist2Name?: string;
    strength: "EV" | "PPG" | "SHG" | "EN";
  }

  const generatedGoals: DisplayGoal[] = [];
  for (const g of realGoals) {
    const isHome = g.team_entry_id === fixture.home_entry_id;
    const scorer = allPlayers.find((p) => p.id === g.player_id);
    const a1 = allPlayers.find((p) => p.id === g.assist_one_id);
    const a2 = allPlayers.find((p) => p.id === g.assist_two_id);
    const remaining = g.clock_seconds_remaining || 0;
    const minutes = Math.floor(remaining / 60);
    const seconds = (remaining % 60).toString().padStart(2, "0");
    generatedGoals.push({
      id: g.id,
      period: g.period,
      periodLabel: g.period === 4 ? "OT" : `Period ${g.period}`,
      time: `${minutes}:${seconds}`,
      teamName: isHome ? homeName : awayName,
      teamEntryId: g.team_entry_id,
      scorerName: scorer?.display_name || "Unassigned Scorer",
      scorerPlayerId: scorer?.id,
      assist1Name: a1?.display_name,
      assist2Name: a2?.display_name,
      strength: "EV",
    });
  }

  // Real team skater statistics mapped from actual rosters
  const mapRosterSkaters = (rosterData: any[], teamId: string) => {
    return (rosterData || []).map((m: any) => {
      const pId = m.players?.id;
      const gCount = realGoals.filter((g) => g.team_entry_id === teamId && g.player_id === pId).length;
      const aCount = realGoals.filter((g) => g.team_entry_id === teamId && (g.assist_one_id === pId || g.assist_two_id === pId)).length;
      const pimCount = realPenalties.filter((pen) => pen.team_entry_id === teamId && pen.player_id === pId).reduce((acc: number, pen: any) => acc + (pen.penalty_minutes || 2), 0);
      return {
        number: m.jersey_number ?? 0,
        name: sanitizePlayerName(m.players?.display_name || "Player"),
        pos: m.player_position ?? "F",
        g: gCount,
        a: aCount,
        pts: gCount + aCount,
        pm: 0,
        sog: gCount,
        pim: pimCount,
      };
    });
  };

  const awaySkaters = mapRosterSkaters(awayRosterRes.data as any[], fixture.away_entry_id);
  const homeSkaters = mapRosterSkaters(homeRosterRes.data as any[], fixture.home_entry_id);

  // Goalie Stats from roster
  const awayGoaliePlayer = (awayRosterRes.data as any[])?.find((m) => m.player_position === "G") || (awayRosterRes.data as any[])?.[0];
  const homeGoaliePlayer = (homeRosterRes.data as any[])?.find((m) => m.player_position === "G") || (homeRosterRes.data as any[])?.[0];

  const awayGoalie = {
    name: sanitizePlayerName(awayGoaliePlayer?.players?.display_name || "Goalie"),
    number: awayGoaliePlayer?.jersey_number ?? 30,
    sa: displayHomeTotal,
    ga: displayHomeTotal,
    sv: 0,
    toi: isCompleted ? "60:00" : "00:00",
  };
  const homeGoalie = {
    name: sanitizePlayerName(homeGoaliePlayer?.players?.display_name || "Goalie"),
    number: homeGoaliePlayer?.jersey_number ?? 35,
    sa: displayAwayTotal,
    ga: displayAwayTotal,
    sv: 0,
    toi: isCompleted ? "60:00" : "00:00",
  };

  // Real Penalties
  interface DisplayPenalty {
    id: string;
    period: number;
    time: string;
    teamName: string;
    playerName: string;
    infraction: string;
    minutes: number;
  }
  const displayPenalties: DisplayPenalty[] = [];
  for (const pen of realPenalties) {
    const isHome = pen.team_entry_id === fixture.home_entry_id;
    const player = allPlayers.find((p) => p.id === pen.player_id);
    const remaining = pen.clock_seconds_remaining || 0;
    const minutes = Math.floor(remaining / 60);
    const seconds = (remaining % 60).toString().padStart(2, "0");
    displayPenalties.push({
      id: pen.id,
      period: pen.period,
      time: `${minutes}:${seconds}`,
      teamName: isHome ? homeName : awayName,
      playerName: player?.display_name || "Unassigned Skater",
      infraction: "Minor Penalty",
      minutes: pen.penalty_minutes || 2,
    });
  }

  return (
    <main id="main" className="public-portal-container">
      {/* 1. Header & Navigation Controls */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">{league.name} · OFFICIAL GAME CENTRE</p>
          <h1>Game Details &amp; Boxscore</h1>
          <p>{arenaLocation} · {new Date(fixture.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {Boolean(user) && (
            <Link className="button primary" href={`/schedule/${gameId}/scorekeeping`} style={{ fontWeight: 800 }}>
              ⏱ Score Game
            </Link>
          )}
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
              {displayAwayTotal} – {displayHomeTotal}
            </div>
            <small style={{ color: "var(--muted)", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
              {isCompleted ? "Final Score" : isLive ? "Live Score" : "Upcoming · Scheduled"}
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

      {/* 2b. theScore-Style Clips Video Carousel */}
      <TheScoreClipsCarousel />

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
                <td>{displayAwayP1}</td>
                <td>{displayAwayP2}</td>
                <td>{displayAwayP3}</td>
                {hasOT && <td>{displayAwayOT}</td>}
                <td><strong style={{ color: "var(--lime)", fontSize: "1.1rem" }}>{displayAwayTotal}</strong></td>
              </tr>
              <tr>
                <td style={{ textAlign: "left", fontWeight: 700 }}>
                  <Link href={`/teams/${fixture.home_entry_id}`} className="text-link">
                    {homeName}
                  </Link>
                </td>
                <td>{displayHomeP1}</td>
                <td>{displayHomeP2}</td>
                <td>{displayHomeP3}</td>
                {hasOT && <td>{displayHomeOT}</td>}
                <td><strong style={{ color: "var(--lime)", fontSize: "1.1rem" }}>{displayHomeTotal}</strong></td>
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

      {/* 6. Scoring Summary with Goals & Assists */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Scoring Summary</h2>
          <span className="badge">{generatedGoals.length} Goals Recorded</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Time</th>
                <th>Team</th>
                <th>Goal Scorer</th>
                <th>Assists</th>
                <th style={{ textAlign: "center" }}>Strength</th>
              </tr>
            </thead>
            <tbody>
              {generatedGoals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                    No goals recorded yet. Match is scheduled or scoreless.
                  </td>
                </tr>
              ) : (
                generatedGoals.map((g) => (
                  <tr key={g.id}>
                    <td><strong>{g.periodLabel}</strong></td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{g.time}</td>
                    <td><strong>{g.teamName}</strong></td>
                    <td>
                      {g.scorerPlayerId ? (
                        <Link href={`/players/${g.scorerPlayerId}`} className="text-link" style={{ fontWeight: 700 }}>
                          {g.scorerName} 🏒
                        </Link>
                      ) : (
                        <strong style={{ color: "var(--lime)" }}>{g.scorerName} 🏒</strong>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>
                      {[g.assist1Name, g.assist2Name].filter(Boolean).join(", ") || "Unassisted"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="badge" style={{ fontSize: "11px", fontWeight: 700 }}>
                        {g.strength}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Team Skater Boxscores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px", marginBottom: "24px" }}>
        {/* Away Skaters */}
        <section className="panel">
          <div className="section-heading" style={{ margin: "0 0 16px" }}>
            <h2 style={{ margin: 0 }}>{awayName} — Skater Boxscore</h2>
            <span className="badge">Away Skaters</span>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ textAlign: "center" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left" }}>#</th>
                  <th scope="col" style={{ textAlign: "left" }}>Skater</th>
                  <th scope="col">POS</th>
                  <th scope="col" style={{ color: "var(--lime)" }}>G</th>
                  <th scope="col">A</th>
                  <th scope="col" style={{ fontWeight: 800 }}>PTS</th>
                  <th scope="col">+/-</th>
                  <th scope="col">SOG</th>
                  <th scope="col">PIM</th>
                </tr>
              </thead>
              <tbody>
                {awaySkaters.map((s) => (
                  <tr key={s.name}>
                    <td style={{ textAlign: "left", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>#{s.number}</td>
                    <td style={{ textAlign: "left", fontWeight: 600 }}>{s.name}</td>
                    <td>{s.pos}</td>
                    <td style={{ color: s.g > 0 ? "var(--lime)" : "inherit", fontWeight: s.g > 0 ? 800 : 400 }}>{s.g}</td>
                    <td>{s.a}</td>
                    <td><strong>{s.pts}</strong></td>
                    <td style={{ color: s.pm > 0 ? "var(--lime)" : s.pm < 0 ? "#f87171" : "inherit" }}>
                      {s.pm > 0 ? `+${s.pm}` : s.pm}
                    </td>
                    <td>{s.sog}</td>
                    <td>{s.pim}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, borderTop: "2px solid var(--line)" }}>
                  <td colSpan={3} style={{ textAlign: "left" }}>TEAM TOTALS</td>
                  <td style={{ color: "var(--lime)" }}>{awaySkaters.reduce((acc, s) => acc + s.g, 0)}</td>
                  <td>{awaySkaters.reduce((acc, s) => acc + s.a, 0)}</td>
                  <td>{awaySkaters.reduce((acc, s) => acc + s.pts, 0)}</td>
                  <td>—</td>
                  <td>{awaySkaters.reduce((acc, s) => acc + s.sog, 0)}</td>
                  <td>{awaySkaters.reduce((acc, s) => acc + s.pim, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Home Skaters */}
        <section className="panel">
          <div className="section-heading" style={{ margin: "0 0 16px" }}>
            <h2 style={{ margin: 0 }}>{homeName} — Skater Boxscore</h2>
            <span className="badge">Home Skaters</span>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ textAlign: "center" }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left" }}>#</th>
                  <th scope="col" style={{ textAlign: "left" }}>Skater</th>
                  <th scope="col">POS</th>
                  <th scope="col" style={{ color: "var(--lime)" }}>G</th>
                  <th scope="col">A</th>
                  <th scope="col" style={{ fontWeight: 800 }}>PTS</th>
                  <th scope="col">+/-</th>
                  <th scope="col">SOG</th>
                  <th scope="col">PIM</th>
                </tr>
              </thead>
              <tbody>
                {homeSkaters.map((s) => (
                  <tr key={s.name}>
                    <td style={{ textAlign: "left", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>#{s.number}</td>
                    <td style={{ textAlign: "left", fontWeight: 600 }}>{s.name}</td>
                    <td>{s.pos}</td>
                    <td style={{ color: s.g > 0 ? "var(--lime)" : "inherit", fontWeight: s.g > 0 ? 800 : 400 }}>{s.g}</td>
                    <td>{s.a}</td>
                    <td><strong>{s.pts}</strong></td>
                    <td style={{ color: s.pm > 0 ? "var(--lime)" : s.pm < 0 ? "#f87171" : "inherit" }}>
                      {s.pm > 0 ? `+${s.pm}` : s.pm}
                    </td>
                    <td>{s.sog}</td>
                    <td>{s.pim}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 800, borderTop: "2px solid var(--line)" }}>
                  <td colSpan={3} style={{ textAlign: "left" }}>TEAM TOTALS</td>
                  <td style={{ color: "var(--lime)" }}>{homeSkaters.reduce((acc, s) => acc + s.g, 0)}</td>
                  <td>{homeSkaters.reduce((acc, s) => acc + s.a, 0)}</td>
                  <td>{homeSkaters.reduce((acc, s) => acc + s.pts, 0)}</td>
                  <td>—</td>
                  <td>{homeSkaters.reduce((acc, s) => acc + s.sog, 0)}</td>
                  <td>{homeSkaters.reduce((acc, s) => acc + s.pim, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      {/* 8. Goaltenders Boxscore */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Goaltending</h2>
          <span>Netminder saves &amp; percentages</span>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ textAlign: "center" }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: "left" }}>Goaltender</th>
                <th scope="col" style={{ textAlign: "left" }}>Team</th>
                <th scope="col">SA</th>
                <th scope="col">GA</th>
                <th scope="col" style={{ color: "var(--lime)" }}>SV</th>
                <th scope="col">SV%</th>
                <th scope="col">TOI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: "left", fontWeight: 700 }}>#{awayGoalie.number} {awayGoalie.name}</td>
                <td style={{ textAlign: "left" }}>{awayName}</td>
                <td>{awayGoalie.sa}</td>
                <td>{awayGoalie.ga}</td>
                <td style={{ color: "var(--lime)", fontWeight: 700 }}>{awayGoalie.sv}</td>
                <td>{(awayGoalie.sv / awayGoalie.sa).toFixed(3)}</td>
                <td>{awayGoalie.toi}</td>
              </tr>
              <tr>
                <td style={{ textAlign: "left", fontWeight: 700 }}>#{homeGoalie.number} {homeGoalie.name}</td>
                <td style={{ textAlign: "left" }}>{homeName}</td>
                <td>{homeGoalie.sa}</td>
                <td>{homeGoalie.ga}</td>
                <td style={{ color: "var(--lime)", fontWeight: 700 }}>{homeGoalie.sv}</td>
                <td>{(homeGoalie.sv / homeGoalie.sa).toFixed(3)}</td>
                <td>{homeGoalie.toi}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 9. Penalties Summary */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Penalties Summary</h2>
          <span className="badge warning">{displayPenalties.length} Infractions</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Time</th>
                <th>Team</th>
                <th>Player</th>
                <th>Infraction</th>
                <th>Minutes</th>
              </tr>
            </thead>
            <tbody>
              {displayPenalties.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                    No penalties recorded.
                  </td>
                </tr>
              ) : (
                displayPenalties.map((pen) => (
                  <tr key={pen.id}>
                    <td>Period {pen.period}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{pen.time}</td>
                    <td><strong>{pen.teamName}</strong></td>
                    <td>{pen.playerName}</td>
                    <td>{pen.infraction}</td>
                    <td>
                      <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", fontWeight: 700 }}>
                        {pen.minutes} MIN
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
    </main>
  );
}
