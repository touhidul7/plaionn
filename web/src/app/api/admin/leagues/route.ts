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
      if (result.error || !result.data.user) return NextResponse.json({ success: false, message: "Could not invite the commissioner. No league was created." }, { status: 502 });
      user = result.data.user;
    }
    const { data: id, error } = await db.rpc("provision_admin_league", {
      league_name: value.name, league_domain: value.domain, season_name: value.season,
      commissioner_id: user.id, commissioner_email: value.commissioner, legacy_id: value.legacyId ?? null,
    });
    if (error) return NextResponse.json({ success: false, message: "Could not save the league assignment. Check that the domain is unique and database migrations are applied." }, { status: 409 });
    return NextResponse.json({ success: true, league: (await listAdminLeagues(access)).find(l => l.id === id) });
  } catch {
    return NextResponse.json({ success: false, message: "League administration is unavailable. Check the server configuration and database migrations." }, { status: 503 });
  }
}
