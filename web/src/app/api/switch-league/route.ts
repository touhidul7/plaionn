import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminAccess } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leagueId = searchParams.get("league") || "60000000-0000-4000-8000-000000000001";
  const redirectPath = searchParams.get("redirect") || "/";
  if (!z.uuid().safeParse(leagueId).success) return NextResponse.json({ error: "Invalid league" }, { status: 400 });
  const destination = new URL(redirectPath, request.url);
  if (destination.origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid redirect" }, { status: 400 });
  const isPublicPath = [
    "/",
    "/schedule",
    "/standings",
    "/leaders",
    "/teams",
    "/playoffs",
    "/registration",
    "/announcements",
  ].includes(destination.pathname) || destination.pathname.startsWith("/schedule/");

  if (!isPublicPath) {
    const access = await getAdminAccess();
    if (!access.user) return NextResponse.redirect(new URL("/login", request.url));
    if (!access.canManageLeague(leagueId)) return NextResponse.json({ error: "League access denied" }, { status: 403 });
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set("plaionn-league", leagueId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });

  return response;
}
