"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/supabase/admin";

export interface AdminActionResult {
  success: boolean;
  message: string;
}

export async function addStaffMemberAction({
  leagueId,
  email,
  role,
}: {
  leagueId: string;
  email: string;
  role: string;
}): Promise<AdminActionResult> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, message: "Enter a valid email address." };
  }

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Super Admin or Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);

  // Try add_league_member_by_email RPC
  try {
    const { error: rpcErr } = await supabase.rpc("add_league_member_by_email", {
      target_league: leagueId,
      target_email: cleanEmail,
      target_role: role || "commissioner",
    });

    if (!rpcErr) {
      revalidatePath(`/admin/league/${leagueId}`);
      return { success: true, message: `Successfully assigned ${role} role to ${cleanEmail}.` };
    }
  } catch {
    // Fallback to auth lookup
  }

  // Fallback: look up user in auth.users
  const { data: userList } = await supabase.auth.admin.listUsers();
  const matchedUser = userList?.users?.find(
    (u) => u.email?.toLowerCase() === cleanEmail
  );

  if (!matchedUser) {
    return {
      success: false,
      message: `User with email "${cleanEmail}" does not have an account yet. Ask them to register, then assign their role.`,
    };
  }

  const { error: insErr } = await supabase.from("league_memberships").upsert(
    {
      league_id: leagueId,
      user_id: matchedUser.id,
      role: role || "commissioner",
    },
    { onConflict: "league_id,user_id,role" }
  );

  if (insErr) {
    return { success: false, message: insErr.message };
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Successfully assigned ${role} role to ${cleanEmail}.` };
}

export async function removeStaffMemberAction({
  leagueId,
  userId,
  role,
}: {
  leagueId: string;
  userId: string;
  role: string;
}): Promise<AdminActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Super Admin or Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase
    .from("league_memberships")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .eq("role", role);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: "Staff member removed from this league." };
}

export async function saveLeagueDomainAction({
  leagueId,
  domain,
}: {
  leagueId: string;
  domain: string;
}): Promise<AdminActionResult> {
  const cleanDomain = (domain || "").trim().toLowerCase().replace(/^https?:\/\//, "");
  if (!cleanDomain) {
    return { success: false, message: "Enter a valid domain name." };
  }

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);

  // Persist domain in system theme record
  const { data: existing } = await supabase
    .from("league_announcements")
    .select("id, message")
    .eq("league_id", leagueId)
    .eq("title", "__LEAGUE_THEME__")
    .order("created_at", { ascending: false })
    .limit(1);

  let existingData: Record<string, any> = {};
  if (existing && existing[0]?.message) {
    try {
      existingData = JSON.parse(existing[0].message);
    } catch {}
  }

  const newPayload = JSON.stringify({
    ...existingData,
    domain: cleanDomain,
    updatedAt: new Date().toISOString(),
  });

  if (existing && existing.length > 0) {
    await supabase
      .from("league_announcements")
      .update({
        message: newPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id);
  } else {
    await supabase
      .from("league_announcements")
      .insert({
        league_id: leagueId,
        title: "__LEAGUE_THEME__",
        message: newPayload,
        priority: "standard",
      });
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return {
    success: true,
    message: `Domain "${cleanDomain}" registered. Configure DNS CNAME pointing to plaionn.brittosoft.online.`,
  };
}

export async function createSeasonAction({
  leagueId,
  name,
}: {
  leagueId: string;
  name: string;
}): Promise<AdminActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) return { success: false, message: "Season name must be at least 2 characters." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { data: newSeason, error } = await supabase
    .from("seasons")
    .insert({ league_id: leagueId, name: cleanName })
    .select("id")
    .single();

  if (error) return { success: false, message: error.message };

  if (newSeason?.id) {
    const today = new Date().toISOString().split("T")[0];
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
    await supabase.from("season_settings").insert({
      season_id: newSeason.id,
      league_id: leagueId,
      roster_limit: 20,
      period_count: 3,
      period_minutes: 20,
      clock_mode: "stop",
      win_points: 2,
      tie_points: 1,
      loss_points: 0,
      overtime_loss_points: 1,
      billing_model: "both",
      currency: "CAD",
      team_fee_cents: 100000,
      player_fee_cents: 15000,
      registration_opens: today,
      registration_closes: nextYear,
      registration_enabled: true,
      standings_tiebreakers: ["wins", "goal_difference", "goals_for", "head_to_head", "fewest_penalties"],
    });
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Season "${cleanName}" created.` };
}

export async function createDivisionAction({
  leagueId,
  seasonId,
  name,
}: {
  leagueId: string;
  seasonId: string;
  name: string;
}): Promise<AdminActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) return { success: false, message: "Division name must be at least 2 characters." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase
    .from("divisions")
    .insert({ league_id: leagueId, season_id: seasonId, name: cleanName });

  if (error) return { success: false, message: error.message };

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Division "${cleanName}" created.` };
}

export async function createTeamAction({
  leagueId,
  divisionId,
  name,
}: {
  leagueId: string;
  divisionId: string;
  name: string;
}): Promise<AdminActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) return { success: false, message: "Team name must be at least 2 characters." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.rpc("create_team_with_entry", {
    target_league: leagueId,
    target_division: divisionId,
    team_name: cleanName,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Team "${cleanName}" added successfully.` };
}

export async function updateTeamAction({
  leagueId,
  entryId,
  teamId,
  name,
  divisionId,
}: {
  leagueId: string;
  entryId: string;
  teamId: string;
  name: string;
  divisionId?: string;
}): Promise<AdminActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) return { success: false, message: "Team name must be at least 2 characters." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  // Update team name
  if (teamId) {
    await supabase.from("teams").update({ name: cleanName }).eq("id", teamId);
  }
  // Update entry division if provided
  if (divisionId && entryId) {
    await supabase.from("team_entries").update({ division_id: divisionId }).eq("id", entryId);
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Team details updated.` };
}

export async function saveLeagueBrandingAction({
  leagueId,
  primaryColor,
  secondaryColor,
}: {
  leagueId: string;
  primaryColor: string;
  secondaryColor?: string;
}): Promise<AdminActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);

  // Persist branding colors into system theme record
  const { data: existing } = await supabase
    .from("league_announcements")
    .select("id, message")
    .eq("league_id", leagueId)
    .eq("title", "__LEAGUE_THEME__")
    .order("created_at", { ascending: false })
    .limit(1);

  let existingData: Record<string, any> = {};
  if (existing && existing[0]?.message) {
    try {
      existingData = JSON.parse(existing[0].message);
    } catch {}
  }

  const newPayload = JSON.stringify({
    ...existingData,
    primaryColor,
    updatedAt: new Date().toISOString(),
  });

  let error;
  if (existing && existing.length > 0) {
    const res = await supabase
      .from("league_announcements")
      .update({
        message: newPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing[0].id);
    error = res.error;
  } else {
    const res = await supabase
      .from("league_announcements")
      .insert({
        league_id: leagueId,
        title: "__LEAGUE_THEME__",
        message: newPayload,
        priority: "standard",
      });
    error = res.error;
  }

  if (error) {
    return { success: false, message: `Failed to save branding: ${error.message}` };
  }

  revalidatePath(`/admin/league/${leagueId}`);
  revalidatePath("/");
  revalidatePath("/schedule");
  return { success: true, message: `League branding color palette updated to ${primaryColor}.` };
}

export async function createGameAction({
  leagueId,
  homeEntryId,
  awayEntryId,
  startsAt,
  rinkId,
}: {
  leagueId: string;
  homeEntryId: string;
  awayEntryId: string;
  startsAt: string;
  rinkId?: string;
}): Promise<AdminActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.from("games").insert({
    league_id: leagueId,
    home_entry_id: homeEntryId,
    away_entry_id: awayEntryId,
    starts_at: startsAt,
    rink_id: rinkId || null,
    status: "scheduled",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath(`/admin/league/${leagueId}`);
  revalidatePath("/schedule");
  return { success: true, message: "Match fixture created successfully." };
}

export async function updateSeasonAction({
  leagueId,
  seasonId,
  name,
}: {
  leagueId: string;
  seasonId: string;
  name: string;
}): Promise<AdminActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) return { success: false, message: "Season name must be at least 2 characters." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.from("seasons").update({ name: cleanName }).eq("id", seasonId).eq("league_id", leagueId);
  if (error) return { success: false, message: error.message };

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Season updated to "${cleanName}".` };
}

export async function updateDivisionAction({
  leagueId,
  divisionId,
  seasonId,
  name,
}: {
  leagueId: string;
  divisionId: string;
  seasonId?: string;
  name: string;
}): Promise<AdminActionResult> {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2) return { success: false, message: "Division name must be at least 2 characters." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const updates: Record<string, any> = { name: cleanName };
  if (seasonId) updates.season_id = seasonId;

  const { error } = await supabase.from("divisions").update(updates).eq("id", divisionId).eq("league_id", leagueId);
  if (error) return { success: false, message: error.message };

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Division updated to "${cleanName}".` };
}

export async function createRosterPlayerAction({
  leagueId,
  teamEntryId,
  playerName,
  jerseyNumber,
  position,
  status,
  email,
}: {
  leagueId: string;
  teamEntryId: string;
  playerName: string;
  jerseyNumber?: number;
  position?: string;
  status?: string;
  email?: string;
}): Promise<AdminActionResult> {
  const cleanName = (playerName || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  if (cleanName.length < 2) return { success: false, message: "Player name must be at least 2 characters." };
  if (!teamEntryId) return { success: false, message: "Please select a team." };

  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);

  // 1. Look up existing player to prevent duplicates (by email in registrations or display_name)
  let playerId: string | null = null;
  if (cleanEmail) {
    const { data: regList } = await supabase
      .from("player_registrations")
      .select("player_id")
      .eq("league_id", leagueId)
      .ilike("user_id", cleanEmail)
      .limit(1);
    if (regList && regList[0]?.player_id) {
      playerId = regList[0].player_id;
    }
  }

  if (!playerId) {
    const { data: existingPlayers } = await supabase
      .from("players")
      .select("id")
      .ilike("display_name", cleanName)
      .limit(1);
    if (existingPlayers && existingPlayers[0]) {
      playerId = existingPlayers[0].id;
    } else {
      const { data: newPlayer, error: pErr } = await supabase
        .from("players")
        .insert({ display_name: cleanName })
        .select("id")
        .single();
      if (pErr || !newPlayer) {
        return { success: false, message: pErr?.message || "Could not register player profile." };
      }
      playerId = newPlayer.id;
    }
  }

  // 2. Link player to league_players
  await supabase.from("league_players").upsert(
    { league_id: leagueId, player_id: playerId },
    { onConflict: "league_id,player_id" }
  );

  // 3. Upsert roster membership
  const { error: rErr } = await supabase.from("roster_memberships").upsert(
    {
      league_id: leagueId,
      team_entry_id: teamEntryId,
      player_id: playerId,
      jersey_number: jerseyNumber || 0,
      position: position || "F",
      status: status || "active",
    },
    { onConflict: "team_entry_id,player_id" }
  );

  if (rErr) return { success: false, message: rErr.message };

  // 4. Save registration record with email if provided
  if (cleanEmail) {
    await supabase.from("player_registrations").insert({
      league_id: leagueId,
      user_id: cleanEmail,
      player_id: playerId,
      position: position || "F",
      status: status === "active" ? "cleared" : "pending_waiver",
    });
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return { success: true, message: `Player "${cleanName}" registered and added to team roster.` };
}

export async function updateGameStatusAction({
  leagueId,
  gameId,
  status,
}: {
  leagueId: string;
  gameId: string;
  status: "scheduled" | "in_progress" | "final";
}): Promise<AdminActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.from("games").update({ status }).eq("id", gameId).eq("league_id", leagueId);
  if (error) return { success: false, message: error.message };

  revalidatePath(`/admin/league/${leagueId}`);
  revalidatePath("/schedule");
  return { success: true, message: `Game status updated to ${status}.` };
}

export async function recordGameGoalAction({
  leagueId,
  gameId,
  teamEntryId,
  playerId,
  period = 1,
}: {
  leagueId: string;
  gameId: string;
  teamEntryId: string;
  playerId?: string;
  period?: number;
}): Promise<AdminActionResult> {
  return recordGamePlayEventAction({
    leagueId,
    gameId,
    eventKind: "goal",
    teamEntryId,
    playerId,
    period,
  });
}

export async function recordGamePlayEventAction({
  leagueId,
  gameId,
  eventKind = "goal",
  teamEntryId,
  playerId,
  period = 1,
}: {
  leagueId: string;
  gameId: string;
  eventKind: "goal" | "save" | "penalty";
  teamEntryId: string;
  playerId?: string;
  period?: number;
}): Promise<AdminActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  const supabase = await createSupabaseServerClient(true);
  const { error } = await supabase.from("game_events").insert({
    game_id: gameId,
    league_id: leagueId,
    client_event_id: crypto.randomUUID(),
    event_kind: eventKind,
    team_entry_id: teamEntryId,
    period: period || 1,
    clock_seconds_remaining: 1200,
    player_id: playerId || null,
    recorded_by: access.user.id,
  });

  if (error) return { success: false, message: error.message };

  if (eventKind === "goal") {
    // Set game status to in_progress if scheduled
    await supabase.from("games").update({ status: "in_progress" }).eq("id", gameId).eq("status", "scheduled");
  }

  revalidatePath(`/admin/league/${leagueId}`);
  revalidatePath("/schedule");
  return {
    success: true,
    message: eventKind === "goal" ? "Goal recorded successfully!" : eventKind === "save" ? "Goalie save recorded!" : "Penalty recorded!",
  };
}

export async function bulkImportTeamsAndRostersAction({
  leagueId,
  divisionId,
  csvData,
}: {
  leagueId: string;
  divisionId: string;
  csvData: string;
}): Promise<AdminActionResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return { success: false, message: "Commissioner access is required." };
  }

  if (!divisionId) return { success: false, message: "Please select a target division." };
  if (!csvData || !csvData.trim()) return { success: false, message: "Please provide CSV data." };

  const lines = csvData
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.toLowerCase().startsWith("team"));

  if (lines.length === 0) {
    return { success: false, message: "No valid data rows found in CSV." };
  }

  const supabase = await createSupabaseServerClient(true);

  // Fetch current teams in this division
  const { data: existingEntries } = await supabase
    .from("team_entries")
    .select("id, teams(id, name)")
    .eq("league_id", leagueId)
    .eq("division_id", divisionId);

  const teamMap = new Map<string, { entryId: string; teamId: string }>();
  (existingEntries || []).forEach((e: any) => {
    if (e.teams?.name) {
      teamMap.set(e.teams.name.toLowerCase().trim(), { entryId: e.id, teamId: e.teams.id });
    }
  });

  let teamsCreated = 0;
  let playersCreated = 0;

  for (const line of lines) {
    // Format: Team Name, Player Name, Jersey, Position, Email
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) continue;

    const teamName = parts[0];
    const playerName = parts[1];
    const jersey = parts[2] ? parseInt(parts[2], 10) : 0;
    const position = parts[3] || "F";
    const email = parts[4] || "";

    if (!teamName || !playerName) continue;

    // 1. Ensure team exists in division
    let teamInfo = teamMap.get(teamName.toLowerCase());
    if (!teamInfo) {
      const { error: rpcErr } = await supabase.rpc("create_team_with_entry", {
        target_league: leagueId,
        target_division: divisionId,
        team_name: teamName,
      });
      if (!rpcErr) {
        // Look up created team entry
        const { data: createdEntry } = await supabase
          .from("team_entries")
          .select("id, team_id")
          .eq("league_id", leagueId)
          .eq("division_id", divisionId)
          .order("id", { ascending: false })
          .limit(1);
        if (createdEntry && createdEntry[0]) {
          teamInfo = { entryId: createdEntry[0].id, teamId: createdEntry[0].team_id };
          teamMap.set(teamName.toLowerCase(), teamInfo);
          teamsCreated++;
        }
      }
    }

    if (!teamInfo) continue;

    // 2. Create or find player with duplicate protection
    let playerId: string | null = null;
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("id")
      .ilike("display_name", playerName)
      .limit(1);

    if (existingPlayer && existingPlayer[0]) {
      playerId = existingPlayer[0].id;
    } else {
      const { data: newP } = await supabase
        .from("players")
        .insert({ display_name: playerName })
        .select("id")
        .single();
      if (newP) playerId = newP.id;
    }

    if (!playerId) continue;

    // 3. Upsert roster membership
    await supabase.from("league_players").upsert(
      { league_id: leagueId, player_id: playerId },
      { onConflict: "league_id,player_id" }
    );

    const { error: rErr } = await supabase.from("roster_memberships").upsert(
      {
        league_id: leagueId,
        team_entry_id: teamInfo.entryId,
        player_id: playerId,
        jersey_number: jersey || 0,
        position: position.toUpperCase() === "G" ? "G" : position.toUpperCase() === "D" ? "D" : "F",
        status: "active",
      },
      { onConflict: "team_entry_id,player_id" }
    );

    if (!rErr) {
      playersCreated++;
      if (email) {
        await supabase.from("player_registrations").insert({
          league_id: leagueId,
          user_id: email.toLowerCase(),
          player_id: playerId,
          position: position.toUpperCase() === "G" ? "G" : "F",
          status: "cleared",
        });
      }
    }
  }

  revalidatePath(`/admin/league/${leagueId}`);
  return {
    success: true,
    message: `Bulk import completed: added/verified ${teamsCreated} teams and ${playersCreated} roster athletes.`,
  };
}
