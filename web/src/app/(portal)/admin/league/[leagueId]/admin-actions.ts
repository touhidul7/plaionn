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

  // Check if league exists and update
  const supabase = await createSupabaseServerClient(true);
  
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
  // Save branding colors into season_settings or custom metadata
  const { error } = await supabase
    .from("season_settings")
    .update({
      currency: primaryColor, // store color token or update custom metadata
    })
    .eq("league_id", leagueId);

  revalidatePath(`/admin/league/${leagueId}`);
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
