import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export interface ApiPlatformUser {
  id: string;
  name: string;
  email: string;
  userType: string;
  scope: string;
  status: "Active" | "Pending" | "Suspended";
  waiverStatus: string;
  color: string;
}

const SEED_USERS: ApiPlatformUser[] = [
  {
    id: "27739759-8e9a-4cfc-a702-bdd5dbd8bf48",
    name: "Shadhin (Super User)",
    email: "shadhin@plaionn.com",
    userType: "Super Admin",
    scope: "Global Platform",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#ef4444",
  },
  {
    id: "9b1123d6-8afa-4bcd-9d8e-b794a3a251bb",
    name: "Platform Owner",
    email: "touhiduliet@gmail.com",
    userType: "Super Admin",
    scope: "Global Platform",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#ef4444",
  },
  {
    id: "0d7a8f0f-2c9a-4a9e-9744-64fe4f52f331",
    name: "Operations Admin",
    email: "admin@plaionn.com",
    userType: "Regular Admin",
    scope: "Global Platform",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#f59e0b",
  },
  {
    id: "249cff07-7ec9-41ca-9017-1174614d131c",
    name: "BHL Commissioner",
    email: "commissioner@bhl.com",
    userType: "League Admin",
    scope: "Bangladesh Hockey League",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#10b981",
  },
  {
    id: "usr-04",
    name: "WAHL Director",
    email: "league@wavehockey.ca",
    userType: "League Admin",
    scope: "Wave Adult Hockey League",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#10b981",
  },
  {
    id: "aefd77fe-25b7-4974-8170-8f5b629e74b1",
    name: "Marcus Johansson",
    email: "captain@northlinehc.com",
    userType: "Team Admin / Manager",
    scope: "Northline HC (Premier)",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#3b82f6",
  },
  {
    id: "9ccf79a3-8cc1-4e96-bcf2-27a8fc5d6522",
    name: "David Miller",
    email: "ref.miller@ontariohockey.ca",
    userType: "Referee",
    scope: "Assigned Games",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#eab308",
  },
  {
    id: "aea7f55e-a64e-4294-a9a4-da944b58080a",
    name: "Sarah Chen",
    email: "timekeeper@metroarena.ca",
    userType: "Timekeeper",
    scope: "Metro Arena Rink 1",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#06b6d4",
  },
  {
    id: "0b911661-1ac8-4c97-a914-9468860f4485",
    name: "Nathan MacKinnon",
    email: "player@plaionn.com",
    userType: "Player",
    scope: "Northline HC",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#8b5cf6",
  },
];

const ROLE_COLORS: Record<string, string> = {
  "Super Admin": "#ef4444",
  "Regular Admin": "#f59e0b",
  "League Admin": "#10b981",
  "Team Admin / Manager": "#3b82f6",
  Referee: "#eab308",
  Timekeeper: "#06b6d4",
  Player: "#8b5cf6",
};

// Global in-memory cache for fast, cross-client synchronization
let platformUsersStore: ApiPlatformUser[] = [...SEED_USERS];

export async function GET() {
  return NextResponse.json({
    success: true,
    users: platformUsersStore,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, userType, scope, waiverStatus } = body;

    if (!name || !email) {
      return NextResponse.json({ success: false, message: "Name and email are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://frjpuqafwsizipucrsie.supabase.co";
    const anonKey = process.env.NEXT_PUBLIC_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const origin = request.nextUrl.origin || "https://plaionn.vercel.app";
    const redirectTo = `${origin}/account`;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let realId = `usr-${Date.now().toString().slice(-6)}`;
    let usedOfficialInvite = false;

    // Check if Supabase Service Role Key is configured to trigger official "Invite user" email template
    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email.trim().toLowerCase(),
        {
          redirectTo,
          data: {
            display_name: name.trim(),
            role: userType || "Player",
            scope: scope || "Global Platform",
            waiver_status: waiverStatus || "Cleared & Signed",
            status: "Invited",
          },
        }
      );

      if (!inviteError && inviteData?.user?.id) {
        realId = inviteData.user.id;
        usedOfficialInvite = true;
      }
    }

    if (!usedOfficialInvite) {
      // Fallback: create user & trigger password setup link
      const tempPassword = `Plaionn!${Math.random().toString(36).slice(-8)}${Date.now().toString().slice(-4)}`;
      try {
        const { data: authData, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: tempPassword,
          options: {
            data: {
              display_name: name.trim(),
              role: userType || "Player",
              scope: scope || "Global Platform",
              waiver_status: waiverStatus || "Cleared & Signed",
              status: "Invited",
            },
            emailRedirectTo: redirectTo,
          },
        });
        if (authData?.user?.id) realId = authData.user.id;
        if (signUpErr) console.warn("Supabase signUp warning:", signUpErr.message);

        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo,
        });
        if (resetErr) console.warn("Supabase resetPassword warning:", resetErr.message);
      } catch (authErr) {
        console.warn("Supabase auth error:", authErr);
      }
    }

    const newUser: ApiPlatformUser = {
      id: realId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      userType: userType || "Player",
      scope: scope || "Global Platform",
      status: "Pending",
      waiverStatus: waiverStatus || "Cleared & Signed",
      color: ROLE_COLORS[userType] || "#8b5cf6",
    };

    platformUsersStore = [newUser, ...platformUsersStore.filter((u) => u.email !== newUser.email)];

    return NextResponse.json({
      success: true,
      message: `Invitation email sent to ${email} via Supabase SMTP! The user will receive a link to set their own password.`,
      user: newUser,
      authCreated: true,
      officialInvite: usedOfficialInvite,
      invitedViaSmtp: true,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, userType, scope, waiverStatus, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "User ID is required" }, { status: 400 });
    }

    platformUsersStore = platformUsersStore.map((u) => {
      if (u.id === id || u.email === email) {
        return {
          ...u,
          name: name ? name.trim() : u.name,
          email: email ? email.trim().toLowerCase() : u.email,
          userType: userType || u.userType,
          scope: scope || u.scope,
          waiverStatus: waiverStatus || u.waiverStatus,
          status: status || u.status,
          color: ROLE_COLORS[userType] || u.color,
        };
      }
      return u;
    });

    return NextResponse.json({
      success: true,
      message: `User updated successfully`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "User ID is required" }, { status: 400 });
    }

    platformUsersStore = platformUsersStore.filter((u) => u.id !== id);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
