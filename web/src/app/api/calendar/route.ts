import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeVenueName, sanitizeSeasonName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

function formatIcsDate(dateString: string): string {
  const d = new Date(dateString);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId") || "60000000-0000-4000-8000-000000000001";
  const teamEntryId = searchParams.get("teamEntryId");

  const supabase = await createSupabaseServerClient(false);

  // Fetch games using the public schedule RPC
  const { data: games, error } = await supabase.rpc("get_public_schedule", {
    target_league: leagueId,
  });

  if (error || !Array.isArray(games)) {
    return new NextResponse("Failed to load schedule", { status: 500 });
  }

  // Filter for specific team if requested
  const filteredGames = teamEntryId
    ? games.filter(
        (g: any) =>
          g.home_entry_id === teamEntryId || g.away_entry_id === teamEntryId
      )
    : games;

  const nowIcs = formatIcsDate(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PLAIONN Hockey Network//Schedule Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText("PLAIONN Hockey Schedule")}`,
    "X-WR-TIMEZONE:America/Toronto",
  ];

  for (const game of filteredGames) {
    if (!game.starts_at) continue;

    const startIcs = formatIcsDate(game.starts_at);
    const endIcs = game.ends_at
      ? formatIcsDate(game.ends_at)
      : formatIcsDate(
          new Date(new Date(game.starts_at).getTime() + 60 * 60 * 1000).toISOString()
        );

    const summary = `${game.home_team_name} vs ${game.away_team_name}`;
    const location = `${sanitizeVenueName(game.venue_name)} - ${game.rink_name || "Rink 1"}`;
    const status = game.status === "cancelled" ? "CANCELLED" : "CONFIRMED";

    let description = `League: ${sanitizeSeasonName(game.season_name)} (${game.division_name})\\nMatchup: ${game.home_team_name} vs ${game.away_team_name}`;
    if (game.home_score !== null && game.away_score !== null) {
      description += `\\nFinal Score: ${game.home_score} - ${game.away_score}`;
    }

    lines.push(
      "BEGIN:VEVENT",
      `UID:${game.game_id}@plaionn.com`,
      `DTSTAMP:${nowIcs}`,
      `DTSTART:${startIcs}`,
      `DTEND:${endIcs}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `DESCRIPTION:${description}`,
      `STATUS:${status}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const icsBody = lines.join("\r\n") + "\r\n";

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="plaionn-schedule.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
