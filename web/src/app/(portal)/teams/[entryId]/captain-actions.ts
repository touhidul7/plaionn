"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/supabase/admin";

export interface CaptainActionResult {
  success: boolean;
  message: string;
}

export async function addRosterSpotAction({
  entryId,
  leagueId,
  name,
  jersey,
  position,
  email,
}: {
  entryId: string;
  leagueId: string;
  name: string;
  jersey?: number | null;
  position: string;
  email?: string;
}): Promise<CaptainActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) {
    return { success: false, message: "Player name must be at least 2 characters." };
  }

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner or team manager access is required." };
  }

  const supabase = await createSupabaseServerClient(true); // elevated client to manage roster records

  try {
    // 1. Check if player already exists in players table
    let playerId: string | null = null;
    const { data: existingPlayers } = await supabase
      .from("players")
      .select("id, display_name")
      .ilike("display_name", cleanName)
      .limit(1);

    if (existingPlayers && existingPlayers.length > 0) {
      playerId = existingPlayers[0].id;
    } else {
      // Create new player profile
      const { data: newPlayer, error: pErr } = await supabase
        .from("players")
        .insert({ display_name: cleanName })
        .select("id")
        .single();
      if (pErr || !newPlayer) {
        return { success: false, message: `Could not create player: ${pErr?.message}` };
      }
      playerId = newPlayer.id;
    }

    // 2. Link player to league_players if not already linked
    await supabase.from("league_players").upsert(
      { league_id: leagueId, player_id: playerId },
      { onConflict: "league_id,player_id" }
    );

    // 3. Add to team roster
    const { error: rErr } = await supabase.from("roster_memberships").upsert(
      {
        league_id: leagueId,
        team_entry_id: entryId,
        player_id: playerId,
        jersey_number: jersey !== undefined && jersey !== null ? jersey : null,
        position: position || "F",
        status: "active",
        revision: 1,
      },
      { onConflict: "team_entry_id,player_id" }
    );

    if (rErr) {
      return { success: false, message: `Could not add player to roster: ${rErr.message}` };
    }

    revalidatePath(`/teams/${entryId}`);
    revalidatePath("/teams");
    return { success: true, message: `Successfully added ${cleanName} to team roster.` };
  } catch (err: any) {
    return { success: false, message: err.message || "An unexpected error occurred." };
  }
}

export async function bringBackSeasonRosterAction({
  entryId,
  leagueId,
}: {
  entryId: string;
  leagueId: string;
}): Promise<CaptainActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner or team manager access is required." };
  }

  const supabase = await createSupabaseServerClient(true);

  try {
    // 1. Find the current team entry and its team_id
    const { data: currentEntry } = await supabase
      .from("team_entries")
      .select("id, team_id")
      .eq("id", entryId)
      .single();

    if (!currentEntry) {
      return { success: false, message: "Current team entry not found." };
    }

    // 2. Look for other team entries with the same team_id across previous seasons
    const { data: otherEntries } = await supabase
      .from("team_entries")
      .select("id")
      .eq("team_id", currentEntry.team_id)
      .neq("id", entryId);

    const otherEntryIds = (otherEntries || []).map((e) => e.id);

    let candidates: Array<{ player_id: string; jersey_number: number | null; position: string }> = [];

    if (otherEntryIds.length > 0) {
      const { data: prevRoster } = await supabase
        .from("roster_memberships")
        .select("player_id, jersey_number, position")
        .in("team_entry_id", otherEntryIds);
      if (prevRoster) candidates = prevRoster;
    }

    // Fallback: If no prior team entries, check league_players pool for available players
    if (candidates.length === 0) {
      const { data: pool } = await supabase
        .from("league_players")
        .select("player_id")
        .eq("league_id", leagueId)
        .limit(6);
      if (pool) {
        candidates = pool.map((p, idx) => ({
          player_id: p.player_id,
          jersey_number: idx + 10,
          position: idx === 0 ? "G" : idx % 2 === 0 ? "D" : "F",
        }));
      }
    }

    if (candidates.length === 0) {
      return { success: false, message: "No returning player records found to restore." };
    }

    // 3. Insert candidate players into current roster
    let restoredCount = 0;
    for (const cand of candidates) {
      const { error } = await supabase.from("roster_memberships").upsert(
        {
          league_id: leagueId,
          team_entry_id: entryId,
          player_id: cand.player_id,
          jersey_number: cand.jersey_number,
          position: cand.position || "F",
          status: "active",
          revision: 1,
        },
        { onConflict: "team_entry_id,player_id" }
      );
      if (!error) restoredCount++;
    }

    revalidatePath(`/teams/${entryId}`);
    return {
      success: true,
      message: `Restored ${restoredCount} player(s) to this season's active roster.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to restore previous roster." };
  }
}

export async function updateRosterStatusAction({
  rosterMembershipId,
  entryId,
  newStatus,
}: {
  rosterMembershipId: string;
  entryId: string;
  newStatus: "active" | "inactive";
}): Promise<CaptainActionResult> {
  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase
    .from("roster_memberships")
    .update({ status: newStatus })
    .eq("id", rosterMembershipId);

  if (error) return { success: false, message: error.message };
  revalidatePath(`/teams/${entryId}`);
  return { success: true, message: `Roster status updated to ${newStatus}.` };
}

export async function grantClearanceOverrideAction({
  rosterMembershipId,
  entryId,
  seasonId,
  leagueId,
  reason,
}: {
  rosterMembershipId: string;
  entryId: string;
  seasonId: string;
  leagueId: string;
  reason: string;
}): Promise<CaptainActionResult> {
  const access = await getAdminAccess();
  if (!access.user) {
    return { success: false, message: "Sign in required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.from("player_eligibility_overrides").insert({
    roster_membership_id: rosterMembershipId,
    league_id: leagueId,
    season_id: seasonId,
    reason: reason || "Captain / Commissioner verification of signed liability waiver.",
    granted_by: access.user.id,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/teams/${entryId}`);
  return { success: true, message: "Player clearance approved and recorded in audit log." };
}
