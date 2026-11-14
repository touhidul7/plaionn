import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
import { getLeagueData } from "@/lib/league";
import { GameLineupBuilder } from "@/components/game-lineup-builder";
import type { LineupPlayer } from "@/lib/lineups-schema";

export const dynamic = "force-dynamic";

export default async function GameLineupPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const { gameId } = await params;
  const { entry: requestedEntry } = await searchParams;

  if (!z.uuid().safeParse(gameId).success) notFound();

  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");

  const gameRes = await supabase
    .from("games")
    .select("id,status,home_entry_id,away_entry_id,starts_at,ends_at")
    .eq("id", gameId)
    .eq("league_id", league.id)
    .maybeSingle();

  if (gameRes.error || !gameRes.data) notFound();
  const game = gameRes.data;

  const leagueData = await getLeagueData();
  const homeTeam = leagueData.teams.find((t) => t.entry_id === game.home_entry_id);
  const awayTeam = leagueData.teams.find((t) => t.entry_id === game.away_entry_id);
  const homeName = homeTeam?.name ?? "Home Team";
  const awayName = awayTeam?.name ?? "Away Team";

  // Select which team lineup to view/edit (defaults to home)
  const selectedEntryId =
    requestedEntry === game.away_entry_id ? game.away_entry_id : game.home_entry_id;
  const selectedTeamName = selectedEntryId === game.home_entry_id ? homeName : awayName;

  // Fetch lineup data
  const lineupRes = await supabase.rpc("get_game_lineup", {
    target_game: gameId,
    target_entry: selectedEntryId,
  });

  const players: LineupPlayer[] =
    !lineupRes.error && Array.isArray(lineupRes.data)
      ? (lineupRes.data as LineupPlayer[])
      : [];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TACTICAL ROSTER</p>
          <h1>Game Lineups &amp; Goalie Status</h1>
          <p>
            {homeName} vs {awayName} · {league.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href={`/schedule/${gameId}/rsvp`}>
            RSVP Check-in
          </Link>
          <Link className="button" href={`/schedule/${gameId}/live`}>
            Game Center
          </Link>
          <Link className="button" href="/schedule">
            Schedules &amp; Scores
          </Link>
        </div>
      </div>

      {/* Team Selection Switcher */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <Link
          className={`button ${selectedEntryId === game.home_entry_id ? "primary" : ""}`}
          href={`/schedule/${gameId}/lineup?entry=${game.home_entry_id}`}
        >
          {homeName} (Home)
        </Link>
        <Link
          className={`button ${selectedEntryId === game.away_entry_id ? "primary" : ""}`}
          href={`/schedule/${gameId}/lineup?entry=${game.away_entry_id}`}
        >
          {awayName} (Away)
        </Link>
      </div>

      <GameLineupBuilder
        gameId={gameId}
        teamEntryId={selectedEntryId}
        teamName={selectedTeamName}
        initialPlayers={players}
        canEdit={Boolean(canManage || user)}
      />
    </>
  );
}
