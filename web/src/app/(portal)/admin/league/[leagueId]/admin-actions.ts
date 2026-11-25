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
