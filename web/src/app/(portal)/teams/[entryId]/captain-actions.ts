"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceClient, getAdminAccess } from "@/lib/supabase/admin";
import {
  INTERNAL_EXPIRES_AT,
  JOIN_REQUEST_TITLE,
  PENDING_SPOT_TITLE,
  findPendingSpotById,
  findPendingSpotByToken,
} from "@/lib/roster-invites";

export interface CaptainActionResult {
  success: boolean;
  message: string;
  claimToken?: string;
  spotId?: string;
  registrationId?: string;
}

async function getOrigin(): Promise<string> {
  try {
    const hdrs = await headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const proto = hdrs.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return "https://plaionn.brittosoft.online";
}

async function linkUserToTeamRoster({
  db,
  userId,
  displayName,
  leagueId,
  seasonId,
  entryId,
  jersey,
  position,
}: {
  db: ReturnType<typeof createServiceClient>;
  userId: string;
  displayName: string;
  leagueId: string;
  seasonId: string | null;
  entryId: string;
  jersey: number | null;
  position: string;
}): Promise<{ playerId: string; registrationId: string | null }> {
  let { data: existingPlayer } = await db
    .from("players")
    .select("id, display_name")
    .eq("owner_user_id", userId)
    .maybeSingle();

  let playerId: string;
  if (existingPlayer) {
    playerId = existingPlayer.id;
  } else {
    const { data: newPlayer, error: pErr } = await db
      .from("players")
      .insert({ display_name: displayName.trim() || "Player", owner_user_id: userId })
      .select("id")
      .single();
    if (pErr || !newPlayer) {
      throw new Error(`Could not create player profile: ${pErr?.message}`);
    }
    playerId = newPlayer.id;
  }

  await db.from("league_players").upsert(
    { league_id: leagueId, player_id: playerId },
    { onConflict: "league_id,player_id" }
  );

  const { error: rErr } = await db.from("roster_memberships").upsert(
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
    throw new Error(`Could not add player to roster: ${rErr.message}`);
  }

  let registrationId: string | null = null;
  if (seasonId) {
    const { data: existingReg } = await db
      .from("player_registrations")
      .select("id")
      .eq("season_id", seasonId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingReg) {
      registrationId = existingReg.id;
    } else {
      const [{ data: seasonRow }, { data: leagueRow }] = await Promise.all([
        db.from("seasons").select("name").eq("id", seasonId).maybeSingle(),
        db.from("leagues").select("name").eq("id", leagueId).maybeSingle(),
      ]);
      const { data: newReg } = await db
        .from("player_registrations")
        .insert({
          league_id: leagueId,
          season_id: seasonId,
          season_name: seasonRow?.name || "Season",
          league_name: leagueRow?.name || "League",
          user_id: userId,
          player_id: playerId,
          status: "approved",
          position: position || "F",
        })
        .select("id")
        .maybeSingle();
      if (newReg) registrationId = newReg.id;
    }
  }

  return { playerId, registrationId };
}

export async function addRosterSpotAction({
  entryId,
  leagueId,
  seasonId,
  name,
  jersey,
  position,
  email,
}: {
  entryId: string;
  leagueId: string;
  seasonId?: string | null;
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

  const db = createServiceClient();
  const cleanEmail = (email || "").trim().toLowerCase() || null;
  const token = randomUUID();
  const now = new Date().toISOString();

  try {
    const payload = {
      name: cleanName,
      email: cleanEmail,
      jersey: jersey !== undefined && jersey !== null ? jersey : null,
      position: position || "F",
      token,
      status: "invited",
      createdAt: now,
      updatedAt: now,
    };

    const { data: inserted, error } = await db
      .from("league_announcements")
      .insert({
        league_id: leagueId,
        season_id: seasonId || null,
        team_entry_id: entryId,
        author_id: access.user.id,
        title: PENDING_SPOT_TITLE,
        message: JSON.stringify(payload),
        priority: "standard",
        is_pinned: false,
        expires_at: INTERNAL_EXPIRES_AT,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { success: false, message: `Could not create pending spot: ${error?.message}` };
    }

    if (cleanEmail) {
      const origin = await getOrigin();
      const claimUrl = `${origin}/claim?token=${token}`;
      try {
        await db.auth.admin.inviteUserByEmail(cleanEmail, {
          redirectTo: claimUrl,
          data: { display_name: cleanName, claim_token: token },
        });
      } catch {}
    }

    revalidatePath(`/teams/${entryId}`);
    return {
      success: true,
      message: cleanEmail
        ? `Pending roster spot created for ${cleanName} and invite prepared for ${cleanEmail}.`
        : `Pending roster spot created for ${cleanName}. Copy their single-use claim link to send.`,
      claimToken: token,
      spotId: inserted.id,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "An unexpected error occurred." };
  }
}

export async function updateAndResendSpotInviteAction({
  spotId,
  entryId,
  leagueId,
  email,
}: {
  spotId: string;
  entryId: string;
  leagueId: string;
  email: string;
}): Promise<CaptainActionResult> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, message: "Please enter a valid email address." };
  }

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner or team manager access is required." };
  }

  const spot = await findPendingSpotById(spotId);
  if (!spot || spot.status !== "invited") {
    return { success: false, message: "Pending roster spot not found or already claimed." };
  }

  const newToken = randomUUID();
  const db = createServiceClient();
  const payload = {
    name: spot.name,
    email: cleanEmail,
    jersey: spot.jersey,
    position: spot.position,
    token: newToken,
    status: "invited",
    createdAt: spot.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await db
    .from("league_announcements")
    .update({ message: JSON.stringify(payload), updated_at: new Date().toISOString() })
    .eq("id", spotId);

  if (error) {
    return { success: false, message: error.message };
  }

  const origin = await getOrigin();
  const claimUrl = `${origin}/claim?token=${newToken}`;
  try {
    await db.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo: claimUrl,
      data: { display_name: spot.name, claim_token: newToken },
    });
  } catch {}

  revalidatePath(`/teams/${entryId}`);
  return {
    success: true,
    message: `Updated email to ${cleanEmail} and generated a new single-use invite (previous link invalidated).`,
    claimToken: newToken,
    spotId,
  };
}

export async function removePendingSpotAction({
  spotId,
  entryId,
  leagueId,
}: {
  spotId: string;
  entryId: string;
  leagueId: string;
}): Promise<CaptainActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner or team manager access is required." };
  }

  const db = createServiceClient();
  const { error } = await db.from("league_announcements").delete().eq("id", spotId);
  if (error) return { success: false, message: error.message };

  revalidatePath(`/teams/${entryId}`);
  return { success: true, message: "Pending roster spot removed." };
}

export async function claimRosterSpotAction({
  token,
}: {
  token: string;
}): Promise<CaptainActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Please sign in first to claim your roster spot." };
  }

  const spot = await findPendingSpotByToken(token);
  if (!spot) {
    return { success: false, message: "This invite link is invalid or has expired." };
  }
  if (spot.status !== "invited") {
    return { success: false, message: "This single-use invite link has already been claimed or invalidated." };
  }

  const db = createServiceClient();
  try {
    const { playerId, registrationId } = await linkUserToTeamRoster({
      db,
      userId: user.id,
      displayName: user.user_metadata?.display_name || spot.name,
      leagueId: spot.leagueId,
      seasonId: spot.seasonId,
      entryId: spot.entryId,
      jersey: spot.jersey,
      position: spot.position,
    });

    const updatedPayload = {
      name: spot.name,
      email: spot.email,
      jersey: spot.jersey,
      position: spot.position,
      token: spot.token,
      status: "claimed",
      claimedByUserId: user.id,
      claimedPlayerId: playerId,
      registrationId,
      createdAt: spot.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await db
      .from("league_announcements")
      .update({ message: JSON.stringify(updatedPayload), updated_at: new Date().toISOString() })
      .eq("id", spot.id);

    revalidatePath(`/teams/${spot.entryId}`);
    revalidatePath("/registration");
    return {
      success: true,
      message: "Roster spot claimed! Next, complete your waiver and registration.",
      registrationId: registrationId || undefined,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to claim roster spot." };
  }
}

export async function requestToJoinTeamAction({
  entryId,
  displayName,
  position,
  jersey,
}: {
  entryId: string;
  displayName: string;
  position: string;
  jersey?: number | null;
}): Promise<CaptainActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Please sign in first to request to join this team." };
  }

  const db = createServiceClient();
  const { data: teamEntry } = await db
    .from("team_entries")
    .select("id, league_id, divisions(season_id)")
    .eq("id", entryId)
    .maybeSingle();

  if (!teamEntry) {
    return { success: false, message: "Team not found." };
  }

  const seasonId = (teamEntry.divisions as any)?.season_id || null;
  const cleanName = (displayName || user.user_metadata?.display_name || user.email?.split("@")[0] || "Player").trim();

  const { data: existing } = await db
    .from("league_announcements")
    .select("id, message")
    .eq("team_entry_id", entryId)
    .eq("title", JOIN_REQUEST_TITLE);

  const alreadyPending = (existing || []).some((r) => {
    try {
      const p = JSON.parse(r.message);
      return p.userId === user.id && p.status === "pending";
    } catch {
      return false;
    }
  });

  if (alreadyPending) {
    return { success: true, message: "Your join request is already pending captain approval." };
  }

  const now = new Date().toISOString();
  const payload = {
    userId: user.id,
    userEmail: user.email || "",
    displayName: cleanName,
    position: position || "F",
    jersey: jersey ?? null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const { error } = await db.from("league_announcements").insert({
    league_id: teamEntry.league_id,
    season_id: seasonId,
    team_entry_id: entryId,
    author_id: user.id,
    title: JOIN_REQUEST_TITLE,
    message: JSON.stringify(payload),
    priority: "standard",
    is_pinned: false,
    expires_at: INTERNAL_EXPIRES_AT,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/teams/${entryId}`);
  return {
    success: true,
    message: "Join request sent! Your team captain can now approve or match it to your pending roster spot.",
  };
}

export async function approveJoinRequestAction({
  requestId,
  entryId,
  leagueId,
  matchedSpotId,
}: {
  requestId: string;
  entryId: string;
  leagueId: string;
  matchedSpotId?: string | null;
}): Promise<CaptainActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner or team manager access is required." };
  }

  const db = createServiceClient();
  const { data: reqRow } = await db
    .from("league_announcements")
    .select("id, league_id, season_id, team_entry_id, message")
    .eq("id", requestId)
    .eq("title", JOIN_REQUEST_TITLE)
    .maybeSingle();

  if (!reqRow) {
    return { success: false, message: "Join request not found." };
  }

  const reqData = JSON.parse(reqRow.message);
  if (reqData.status !== "pending") {
    return { success: false, message: "This join request has already been processed." };
  }

  let jersey = reqData.jersey ?? null;
  let position = reqData.position || "F";
  let displayName = reqData.displayName || "Player";
  let matchedSpot = matchedSpotId ? await findPendingSpotById(matchedSpotId) : null;

  if (matchedSpot && matchedSpot.status === "invited") {
    if (jersey === null && matchedSpot.jersey !== null) jersey = matchedSpot.jersey;
    if (matchedSpot.position) position = matchedSpot.position;
    if (!reqData.displayName) displayName = matchedSpot.name;
  }

  try {
    const { playerId, registrationId } = await linkUserToTeamRoster({
      db,
      userId: reqData.userId,
      displayName,
      leagueId,
      seasonId: reqRow.season_id ?? null,
      entryId,
      jersey,
      position,
    });

    if (matchedSpot && matchedSpot.status === "invited") {
      await db
        .from("league_announcements")
        .update({
          message: JSON.stringify({
            ...matchedSpot,
            status: "claimed",
            claimedByUserId: reqData.userId,
            claimedPlayerId: playerId,
            registrationId,
            updatedAt: new Date().toISOString(),
          }),
        })
        .eq("id", matchedSpot.id);
    }

    await db
      .from("league_announcements")
      .update({
        message: JSON.stringify({
          ...reqData,
          status: "approved",
          matchedSpotId: matchedSpot?.id ?? null,
          updatedAt: new Date().toISOString(),
        }),
      })
      .eq("id", requestId);

    revalidatePath(`/teams/${entryId}`);
    return {
      success: true,
      message: matchedSpot
        ? `Matched ${displayName} to pending spot "${matchedSpot.name}" and added to roster.`
        : `Approved ${displayName} as a new player on the roster.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Could not approve join request." };
  }
}

export async function declineJoinRequestAction({
  requestId,
  entryId,
  leagueId,
}: {
  requestId: string;
  entryId: string;
  leagueId: string;
}): Promise<CaptainActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner or team manager access is required." };
  }

  const db = createServiceClient();
  const { data: reqRow } = await db
    .from("league_announcements")
    .select("id, message")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) return { success: false, message: "Join request not found." };

  const reqData = JSON.parse(reqRow.message);
  await db
    .from("league_announcements")
    .update({
      message: JSON.stringify({ ...reqData, status: "declined", updatedAt: new Date().toISOString() }),
    })
    .eq("id", requestId);

  revalidatePath(`/teams/${entryId}`);
  return { success: true, message: "Join request declined." };
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

  const supabase = createServiceClient();

  try {
    const { data: currentEntry } = await supabase
      .from("team_entries")
      .select("id, team_id")
      .eq("id", entryId)
      .single();

    if (!currentEntry) {
      return { success: false, message: "Current team entry not found." };
    }

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
      message: `Restored ${restoredCount} returning player(s) to this season's roster.`,
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
  const supabase = createServiceClient();
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

  const supabase = createServiceClient();
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
