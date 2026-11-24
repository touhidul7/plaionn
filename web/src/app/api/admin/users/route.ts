import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient, findAuthUser, getAdminAccess } from "@/lib/supabase/admin";

const userInput = z.object({
  id: z.uuid().optional(), name: z.string().trim().min(1).max(100), email: z.email().toLowerCase(),
  userType: z.enum(["Super Admin", "Regular Admin", "League Admin", "Team Admin / Manager", "Player", "Referee", "Timekeeper"]),
  scope: z.string().trim().min(1).max(100), waiverStatus: z.string().max(100).optional(),
});

async function authorize() {
  const access = await getAdminAccess();
  return access.isPlatformAdmin ? null : NextResponse.json({ success: false, message: "Platform administrator access required." }, { status: access.user ? 403 : 401 });
}

export async function GET() {
  try {
    const denied = await authorize(); if (denied) return denied;
    const db = createServiceClient();
    const users = [];
    const { data: memberships, error: membershipError } = await db.from("league_memberships").select("user_id,role,leagues(name)").eq("role", "commissioner");
    const { data: admins, error: adminError } = await db.from("platform_administrators").select("user_id,role");
    if (membershipError || adminError) throw new Error("Could not load roles.");
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      for (const user of data.users) {
        const admin = admins?.find(a => a.user_id === user.id);
        const assigned = memberships?.filter(m => m.user_id === user.id) ?? [];
        users.push({ id: user.id, email: user.email ?? "", name: user.user_metadata?.display_name || user.email,
          userType: admin ? (admin.role === "super_admin" ? "Super Admin" : "Regular Admin") : assigned.length ? "League Admin" : "Player",
          scope: admin ? "Global Platform" : assigned.map(m => { const league = m.leagues as unknown as { name: string }; return league?.name; }).filter(Boolean).join(", ") || "Unassigned",
          status: user.last_sign_in_at ? "Active" : "Pending", waiverStatus: user.user_metadata?.waiver_status || "Not verified", color: admin ? "#ef4444" : "#10b981" });
      }
      if (data.users.length < 100) break;
    }
    return NextResponse.json({ success: true, users });
  } catch { return NextResponse.json({ success: false, message: "Could not load users and permissions." }, { status: 503 }); }
}

async function save(request: NextRequest, update: boolean) {
  try {
    const denied = await authorize(); if (denied) return denied;
    const parsed = userInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid user details." }, { status: 400 });
    const value = parsed.data;
    // Other role workflows require team/official assignments, not a global label.
    if (!["League Admin", "Player"].includes(value.userType)) return NextResponse.json({ success: false, message: "Use database administration for platform roles, and the league's team or official assignment workflow for other roles." }, { status: 400 });
    const db = createServiceClient();
    let leagueId: string | null = null;
    if (value.userType === "League Admin") {
      const { data, error } = await db.from("leagues").select("id").eq("name", value.scope).single();
      if (error || !data) return NextResponse.json({ success: false, message: "Select a league saved in Supabase first." }, { status: 400 });
      leagueId = data.id;
    }
    let user = await findAuthUser(value.email);
    if (update && (!user || value.id !== user.id)) return NextResponse.json({ success: false, message: "User identity does not match. Email changes require account settings." }, { status: 400 });
    if (!user) {
      const result = await db.auth.admin.inviteUserByEmail(value.email, { redirectTo: `${request.nextUrl.origin}/reset-password`, data: { display_name: value.name } });
      if (result.error || !result.data.user) throw new Error("Invitation failed.");
      user = result.data.user;
    }
    const { data: platformRole, error: platformError } = await db.from("platform_administrators").select("role").eq("user_id", user.id).maybeSingle();
    if (platformError) throw platformError;
    if (platformRole) return NextResponse.json({ success: false, message: "Platform administrator roles must be changed through database administration." }, { status: 409 });
    if (leagueId) {
      const { error } = await db.from("league_memberships").upsert({ user_id: user.id, league_id: leagueId, role: "commissioner" });
      if (error) throw error;
    } else if (update) {
      // Do not silently claim a demotion while existing assignments remain active.
      const { count, error } = await db.from("league_memberships").select("league_id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "commissioner");
      if (error || count) return NextResponse.json({ success: false, message: "Remove existing commissioner assignments in database administration before changing this user to Player." }, { status: 409 });
    }
    const { error } = await db.auth.admin.updateUserById(user.id, { user_metadata: { display_name: value.name } });
    if (error) throw error;
    return NextResponse.json({ success: true, message: "User and league assignment saved.", user: { id: user.id, name: value.name, email: value.email, userType: value.userType, scope: value.scope, status: user.last_sign_in_at ? "Active" : "Pending", waiverStatus: value.waiverStatus || "Not verified", color: "#10b981" } });
  } catch { return NextResponse.json({ success: false, message: "Could not save the user assignment. Please retry." }, { status: 503 }); }
}
export const POST = (request: NextRequest) => save(request, false);
export const PUT = (request: NextRequest) => save(request, true);
export async function DELETE() {
  try {
    const denied = await authorize(); if (denied) return denied;
    return NextResponse.json({ success: false, message: "Account deletion requires database administration to review existing league records." }, { status: 409 });
  } catch { return NextResponse.json({ success: false }, { status: 503 }); }
}
