import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient, findAuthUser, getAdminAccess, listAdminLeagues } from "@/lib/supabase/admin";

const input = z.object({
  name: z.string().trim().min(2).max(100),
  domain: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/).max(253),
  season: z.string().trim().min(2).max(100),
  commissioner: z.email().toLowerCase(),
  legacyId: z.string().regex(/^league-custom-[a-z0-9-]+$/).max(120).optional(),
});

export async function GET() {
  try {
    const access = await getAdminAccess();
    if (!access.user) return NextResponse.json({ success: false }, { status: 401 });
    return NextResponse.json({ success: true, leagues: await listAdminLeagues(access) });
  } catch {
    return NextResponse.json({ success: false, message: "Could not load leagues. Check the database setup." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess();
    if (!access.isPlatformAdmin) return NextResponse.json({ success: false, message: "Platform administrator access required." }, { status: access.user ? 403 : 401 });
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "Enter a league name, valid domain, season, and commissioner email." }, { status: 400 });
    const value = parsed.data;
    const db = createServiceClient();
    let user = await findAuthUser(value.commissioner);
    if (!user && value.legacyId) return NextResponse.json({ success: false, message: "The previous invite has no matching account. Create this league again to send a new invite." }, { status: 409 });
    if (!user) {
      const result = await db.auth.admin.inviteUserByEmail(value.commissioner, { redirectTo: `${request.nextUrl.origin}/reset-password`, data: { display_name: value.commissioner.split("@")[0] } });
      if (result.error || !result.data.user) {
        // Fallback: createUser if inviteUserByEmail is disabled
        const createRes = await db.auth.admin.createUser({
          email: value.commissioner,
          email_confirm: true,
          user_metadata: { display_name: value.commissioner.split("@")[0] },
        });
        if (createRes.data?.user) {
          user = createRes.data.user;
          await db.auth.resetPasswordForEmail(value.commissioner, { redirectTo: `${request.nextUrl.origin}/reset-password` });
        } else {
          return NextResponse.json({ success: false, message: "Could not invite the commissioner. No league was created." }, { status: 502 });
        }
      } else {
        user = result.data.user;
      }
    }

    // Direct insertion into real database tables: leagues, seasons, league_memberships
    const { data: newLeague, error: leagueErr } = await db
      .from("leagues")
      .insert({ name: value.name })
      .select("id, name")
      .single();

    if (leagueErr || !newLeague) {
      return NextResponse.json({ success: false, message: "Could not create league record in database." }, { status: 409 });
    }

    await Promise.all([
      db.from("seasons").insert({ league_id: newLeague.id, name: value.season }),
      db.from("league_memberships").upsert({ league_id: newLeague.id, user_id: user.id, role: "commissioner" }),
    ]);

    const slug = value.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
    const domain = value.domain || `${slug}.plaionn.brittosoft.online`;

    return NextResponse.json({
      success: true,
      league: {
        id: newLeague.id,
        name: newLeague.name,
        domain,
        season: value.season,
        commissioner: value.commissioner,
        status: "Active",
        teams: 0,
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "League administration is unavailable. Check the server configuration and database migrations." }, { status: 503 });
  }
}
