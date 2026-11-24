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
    const { data: memberships } = await db
      .from("league_memberships")
      .select("user_id,role,leagues(name)")
      .eq("role", "commissioner");

    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      for (const user of data.users) {
        const email = (user.email || "").toLowerCase();
        const metaRole = (user.user_metadata?.role || "").toLowerCase();
        const isSuper =
          email === "admin@plaionn.com" ||
          email === "shadhin@plaionn.com" ||
          email === "touhiduliet@gmail.com" ||
          metaRole === "super admin" ||
          metaRole === "super_admin";

        const assigned = memberships?.filter((m) => m.user_id === user.id) ?? [];
        const userType = isSuper
          ? "Super Admin"
          : user.user_metadata?.role || (assigned.length ? "League Admin" : "Player");

        const scope = isSuper
          ? "Global Platform"
          : assigned
              .map((m) => {
                const league = m.leagues as unknown as { name: string };
                return league?.name;
              })
              .filter(Boolean)
              .join(", ") ||
            user.user_metadata?.scope ||
            "Unassigned";

        const color = isSuper
          ? "#ef4444"
          : userType === "Regular Admin"
          ? "#f59e0b"
          : userType === "League Admin"
          ? "#10b981"
          : userType === "Team Admin / Manager"
          ? "#3b82f6"
          : userType === "Referee"
          ? "#eab308"
          : userType === "Timekeeper"
          ? "#06b6d4"
          : "#8b5cf6";

        users.push({
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.display_name || user.email?.split("@")[0] || "User",
          userType,
          scope,
          status: user.last_sign_in_at ? "Active" : "Pending",
          waiverStatus: user.user_metadata?.waiver_status || "Cleared & Signed",
          color,
        });
      }
      if (data.users.length < 100) break;
    }
    return NextResponse.json({ success: true, users });
  } catch {
    return NextResponse.json({ success: false, message: "Could not load users and permissions." }, { status: 503 });
  }
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
    if (value.userType === "League Admin" && value.scope) {
      let { data: found } = await db.from("leagues").select("id").eq("name", value.scope).maybeSingle();
      if (!found) {
        const cleanScope = value.scope.replace(/\s*\([^)]*\)/g, "").trim();
        const { data: matched } = await db.from("leagues").select("id").ilike("name", `%${cleanScope}%`).maybeSingle();
        found = matched;
      }
      if (!found) {
        const { data: newLg } = await db.from("leagues").insert({ name: value.scope }).select("id").single();
        if (newLg) {
          found = newLg;
          await db.from("seasons").insert({ league_id: newLg.id, name: "Winter 2026" });
        }
      }
      if (found) leagueId = found.id;
    }

    let user = await findAuthUser(value.email);
    if (update && (!user || value.id !== user.id)) return NextResponse.json({ success: false, message: "User identity does not match. Email changes require account settings." }, { status: 400 });

    if (!user) {
      const inviteResult = await db.auth.admin.inviteUserByEmail(value.email, {
        redirectTo: `${request.nextUrl.origin}/reset-password`,
        data: { display_name: value.name, role: value.userType, scope: value.scope }
      });
      if (inviteResult.data?.user) {
        user = inviteResult.data.user;
      } else {
        // Fallback: createUser with email confirmation + reset password link
        const createResult = await db.auth.admin.createUser({
          email: value.email,
          email_confirm: true,
          user_metadata: { display_name: value.name, role: value.userType, scope: value.scope },
        });
        if (createResult.data?.user) {
          user = createResult.data.user;
          await db.auth.resetPasswordForEmail(value.email, {
            redirectTo: `${request.nextUrl.origin}/reset-password`
          });
        } else {
          return NextResponse.json({ success: false, message: inviteResult.error?.message || "Invitation failed." }, { status: 502 });
        }
      }
    }

    if (leagueId) {
      await db.from("league_memberships").upsert({ user_id: user.id, league_id: leagueId, role: "commissioner" });
    }

    await db.auth.admin.updateUserById(user.id, {
      user_metadata: {
        display_name: value.name,
        role: value.userType,
        scope: value.scope,
        waiver_status: value.waiverStatus || "Cleared & Signed",
      }
    });

    return NextResponse.json({
      success: true,
      message: `Invitation email sent to ${value.email}.`,
      user: {
        id: user.id,
        name: value.name,
        email: value.email,
        userType: value.userType,
        scope: value.scope,
        status: user.last_sign_in_at ? "Active" : "Pending",
        waiverStatus: value.waiverStatus || "Cleared & Signed",
        color: "#10b981"
      }
    });
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
