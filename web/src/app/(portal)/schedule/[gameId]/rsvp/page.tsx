import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
import { getLeagueData } from "@/lib/league";
import {
  type PlayerAttendanceRecord,
  computeHeadcount,
} from "@/lib/attendance-schema";
import {
  PlayerRsvpForm,
  TeamAttendanceSection,
} from "@/components/game-attendance-card";

export const dynamic = "force-dynamic";

export default async function GameRsvpPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) notFound();

  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");

  const game = await supabase
    .from("games")
    .select("id,status,home_entry_id,away_entry_id,rink_id,starts_at,ends_at")
    .eq("id", gameId)
    .eq("league_id", league.id)
    .maybeSingle();

  if (game.error) {
    return (
      <section className="panel">
        <h1>Game RSVP Unavailable</h1>
        <p>Could not load the requested game.</p>
        <Link className="button" href="/schedule">
          Back to schedule
        </Link>
      </section>
    );
  }

  if (!game.data) notFound();
  const fixture = game.data;

  const leagueData = await getLeagueData();
  const homeTeam = leagueData.teams.find((t) => t.entry_id === fixture.home_entry_id);
  const awayTeam = leagueData.teams.find((t) => t.entry_id === fixture.away_entry_id);
  const homeName = homeTeam?.name ?? "Home Team";
  const awayName = awayTeam?.name ?? "Away Team";

  // Load attendance records via RPC
  const [homeAttendanceRes, awayAttendanceRes, ownedPlayersRes] = await Promise.all([
    supabase.rpc("list_game_attendance", {
      target_game: gameId,
      target_entry: fixture.home_entry_id,
    }),
    supabase.rpc("list_game_attendance", {
      target_game: gameId,
      target_entry: fixture.away_entry_id,
    }),
    supabase.from("players").select("id,display_name").eq("owner_user_id", user.id),
  ]);

  const hasAttendanceMigration = !homeAttendanceRes.error && !awayAttendanceRes.error;
  const homeRecords: PlayerAttendanceRecord[] = hasAttendanceMigration
    ? (homeAttendanceRes.data as PlayerAttendanceRecord[]) ?? []
    : [];
  const awayRecords: PlayerAttendanceRecord[] = hasAttendanceMigration
    ? (awayAttendanceRes.data as PlayerAttendanceRecord[]) ?? []
    : [];

  const homeHeadcount = computeHeadcount(homeRecords);
  const awayHeadcount = computeHeadcount(awayRecords);

  // Determine which players the current user can RSVP for
  const ownedPlayerIds = new Set((ownedPlayersRes.data ?? []).map((p) => p.id));
  const allGameRecords = [...homeRecords, ...awayRecords];

  const rsvpEligiblePlayers: {
    id: string;
    name: string;
    currentStatus?: string;
    currentNote?: string;
  }[] = [];

  if (canManage) {
    // Commissioners and captains can update attendance for any player on either roster
    for (const r of allGameRecords) {
      rsvpEligiblePlayers.push({
        id: r.player_id,
        name: `${r.display_name} (#${r.jersey_number ?? "—"})`,
        currentStatus: r.rsvp_status,
        currentNote: r.note,
      });
    }
  } else {
    // Regular players can update their own player profile(s)
    for (const r of allGameRecords) {
      if (ownedPlayerIds.has(r.player_id)) {
        rsvpEligiblePlayers.push({
          id: r.player_id,
          name: `${r.display_name} (#${r.jersey_number ?? "—"})`,
          currentStatus: r.rsvp_status,
          currentNote: r.note,
        });
      }
    }
  }

  const startTimeFormatted = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(fixture.starts_at));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{league.name} · GAME RSVP & ATTENDANCE</p>
          <h1>{homeName} vs {awayName}</h1>
          <p>{startTimeFormatted}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href={`/schedule/${gameId}/live`}>
            Live Scoreboard
          </Link>
          <Link className="button" href="/schedule">
            Back to Schedule
          </Link>
        </div>
      </div>

      {!hasAttendanceMigration && (
        <section className="panel notice">
          <h2>Attendance Migration Required</h2>
          <p>
            Please execute migration <code>202611160004_game_attendance_rsvp.sql</code> in the Supabase SQL editor to enable player RSVP and headcount tracking.
          </p>
        </section>
      )}

      {hasAttendanceMigration && (
        <>
          {rsvpEligiblePlayers.length > 0 ? (
            <PlayerRsvpForm
              gameId={gameId}
              players={rsvpEligiblePlayers}
              isCaptainOrCommissioner={canManage}
            />
          ) : (
            <section className="panel" style={{ opacity: 0.85 }}>
              <h3>Player RSVP</h3>
              <p>
                You are viewing attendance as a league spectator. Only rostered players or team captains can submit RSVPs.
              </p>
            </section>
          )}

          <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <TeamAttendanceSection
              teamName={homeName}
              headcount={homeHeadcount}
              records={homeRecords}
            />
            <TeamAttendanceSection
              teamName={awayName}
              headcount={awayHeadcount}
              records={awayRecords}
            />
          </div>
        </>
      )}
    </>
  );
}

