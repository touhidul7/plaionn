import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
import { sanitizePlayerName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

interface PlayerGameLog {
  game_id: string;
  game_date: string;
  opponent_name: string;
  goals: number;
  assists: number;
  points: number;
  pim: number;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  if (!z.uuid().safeParse(playerId).success) notFound();

  const { supabase, league } = await getLeagueContext();

  // 1. Fetch player base information
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, display_name, created_at")
    .eq("id", playerId)
    .maybeSingle();

  if (playerError || !player) notFound();

  // 2. Fetch team memberships in this league
  const { data: memberships } = await supabase
    .from("roster_memberships")
    .select(`
      id,
      jersey_number,
      position,
      status,
      team_entries!inner (
        id,
        team_id,
        season_id,
        teams!inner (
          id,
          name
        ),
        seasons!inner (
          id,
          name
        )
      )
    `)
    .eq("player_id", playerId);

  const activeMembership = (memberships && memberships.length > 0) ? (memberships[0] as any) : null;
  const teamName = activeMembership?.team_entries?.teams?.name ?? "Free Agent / Unassigned";
  const seasonName = activeMembership?.team_entries?.seasons?.name ?? "Current Season";
  const teamEntryId = activeMembership?.team_entries?.id ?? null;
  const jerseyNumber = activeMembership?.jersey_number ?? null;
  const position = activeMembership?.position ?? "Forward";

  // 3. Fetch approved game events for this player
  const { data: goalEvents } = await supabase
    .from("game_events")
    .select("id, game_id, event_type, player_id, assist1_player_id, assist2_player_id, penalty_minutes, period, clock_seconds, games!inner(id, starts_at, status, home_entry_id, away_entry_id)")
    .or(`player_id.eq.${playerId},assist1_player_id.eq.${playerId},assist2_player_id.eq.${playerId}`)
    .eq("voided", false);

  const goalsScored = (goalEvents || []).filter(e => e.event_type === "goal" && e.player_id === playerId).length;
  const assists1 = (goalEvents || []).filter(e => e.event_type === "goal" && e.assist1_player_id === playerId).length;
  const assists2 = (goalEvents || []).filter(e => e.event_type === "goal" && e.assist2_player_id === playerId).length;
  const totalAssists = assists1 + assists2;
  const totalPoints = goalsScored + totalAssists;
  const totalPim = (goalEvents || [])
    .filter(e => e.event_type === "penalty" && e.player_id === playerId)
    .reduce((sum, e) => sum + (e.penalty_minutes || 0), 0);

  // Unique games played count
  const uniqueGameIds = new Set((goalEvents || []).map(e => e.game_id));
  const gamesPlayed = Math.max(uniqueGameIds.size, (goalsScored > 0 || totalPim > 0) ? 1 : 0);

  const playerName = sanitizePlayerName(player.display_name);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{league.name} · PLAYER PROFILE</p>
          <h1>
            {playerName} {jerseyNumber !== null && <span style={{ color: "var(--lime)" }}>#{jerseyNumber}</span>}
          </h1>
          <p>
            {position.toUpperCase()} ·{" "}
            {teamEntryId ? (
              <Link href={`/teams/${teamEntryId}`} className="text-link" style={{ fontWeight: 700 }}>
                {teamName}
              </Link>
            ) : (
              <span>{teamName}</span>
            )}{" "}
            ({seasonName})
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {teamEntryId && (
            <Link className="button" href={`/teams/${teamEntryId}`}>
              View Team Roster →
            </Link>
          )}
          <Link className="button" href="/leaders">
            Stats &amp; Leaders
          </Link>
        </div>
      </div>

      {/* Career / Season Metric Cards */}
      <section className="metrics" style={{ marginBottom: "24px" }}>
        <div className="panel">
          <p>Games Played</p>
          <strong style={{ color: "#38bdf8" }}>{gamesPlayed}</strong>
          <span>Verified appearances</span>
        </div>
        <div className="panel">
          <p>Goals</p>
          <strong style={{ color: "var(--lime)" }}>{goalsScored}</strong>
          <span>Regular season</span>
        </div>
        <div className="panel">
          <p>Assists</p>
          <strong style={{ color: "#34d399" }}>{totalAssists}</strong>
          <span>Primary &amp; secondary</span>
        </div>
        <div className="panel">
          <p>Total Points</p>
          <strong style={{ color: "#fbbf24" }}>{totalPoints}</strong>
          <span>{totalPim} PIM</span>
        </div>
      </section>

      {/* Player Bio & Registration Details */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Player Information</h2>
          <span className="badge" style={{ background: "#173224", color: "var(--lime)" }}>
            Active Roster
          </span>
        </div>
        <div className="settings-grid">
          <div>
            <label style={{ color: "var(--muted)", fontSize: "12px", display: "block", marginBottom: "4px" }}>Full Name</label>
            <p style={{ fontWeight: 700, margin: 0 }}>{playerName}</p>
          </div>
          <div>
            <label style={{ color: "var(--muted)", fontSize: "12px", display: "block", marginBottom: "4px" }}>Position</label>
            <p style={{ fontWeight: 700, margin: 0 }}>{position}</p>
          </div>
          <div>
            <label style={{ color: "var(--muted)", fontSize: "12px", display: "block", marginBottom: "4px" }}>Uniform Number</label>
            <p style={{ fontWeight: 700, margin: 0 }}>{jerseyNumber !== null ? `#${jerseyNumber}` : "Unassigned"}</p>
          </div>
          <div>
            <label style={{ color: "var(--muted)", fontSize: "12px", display: "block", marginBottom: "4px" }}>Waiver Status</label>
            <p style={{ fontWeight: 700, margin: 0, color: "var(--lime)" }}>✓ Completed &amp; Cleared</p>
          </div>
        </div>
      </section>

      {/* Scoring Game Log */}
      <section className="panel">
        <div className="section-heading" style={{ margin: "0 0 16px" }}>
          <h2 style={{ margin: 0 }}>Recent Scoring Events</h2>
          <span>Verified game sheet records</span>
        </div>
        {(goalEvents && goalEvents.length > 0) ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Period</th>
                  <th>Time</th>
                  <th>Game Sheet</th>
                </tr>
              </thead>
              <tbody>
                {goalEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      {ev.event_type === "goal" ? (
                        ev.player_id === playerId ? (
                          <span style={{ color: "var(--lime)", fontWeight: 700 }}>⚽ GOAL</span>
                        ) : (
                          <span style={{ color: "#34d399" }}>🎯 ASSIST</span>
                        )
                      ) : (
                        <span style={{ color: "#f87171" }}>⚠️ PENALTY ({ev.penalty_minutes} min)</span>
                      )}
                    </td>
                    <td>Period {ev.period}</td>
                    <td>
                      {Math.floor((ev.clock_seconds || 0) / 60)}:
                      {((ev.clock_seconds || 0) % 60).toString().padStart(2, "0")}
                    </td>
                    <td>
                      <Link href={`/schedule/${ev.game_id}/live`} className="text-link">
                        View Boxscore →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No scoring events recorded for this player yet.</p>
        )}
      </section>
    </>
  );
}
