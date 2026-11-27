import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminAccess, createServiceClient } from "@/lib/supabase/admin";

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

  // If on hosted domain *.plaionn.brittosoft.online, route directly to the league's isolated subdomain
  if (request.nextUrl.hostname.includes("plaionn.brittosoft.online")) {
    try {
      const db = createServiceClient();
      const { data: lg } = await db.from("leagues").select("name").eq("id", leagueId).maybeSingle();
      if (lg?.name) {
        const sub = lg.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
        if (sub) {
          const targetUrl = new URL(redirectPath, `https://${sub}.plaionn.brittosoft.online`);
          const res = NextResponse.redirect(targetUrl);
          res.cookies.delete("plaionn-theme");
          return res;
        }
      }
    } catch {}
  }

  const response = NextResponse.redirect(destination);
  response.cookies.set("plaionn-league", leagueId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });
  // Clear any legacy global theme cookie so each league dynamically pulls its own theme
  response.cookies.delete("plaionn-theme");

  return response;
}
