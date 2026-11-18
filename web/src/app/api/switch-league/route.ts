import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const leagueId = searchParams.get("league") || "60000000-0000-4000-8000-000000000001";
  const redirectPath = searchParams.get("redirect") || "/";

  const response = NextResponse.redirect(new URL(redirectPath, request.url));
  response.cookies.set("plaionn-league", leagueId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });

  return response;
}
