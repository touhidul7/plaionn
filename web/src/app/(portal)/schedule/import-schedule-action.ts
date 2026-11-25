"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/supabase/admin";
import { startInUtc } from "@/lib/schedule-schema";

export interface BulkImportItem {
  id: string;
  homeEntryId: string;
  awayEntryId: string;
  rinkId: string;
  localStart: string;
  duration: number;
  status: "scheduled" | "draft";
}

export interface BulkImportResult {
  success: boolean;
  importedCount: number;
  errors: string[];
}

export async function bulkImportScheduleAction({
  leagueId,
  games,
}: {
  leagueId: string;
  games: BulkImportItem[];
}): Promise<BulkImportResult> {
  const access = await getAdminAccess();
  if (!access.user || (!access.isPlatformAdmin && !access.canManageLeague(leagueId))) {
    return {
      success: false,
      importedCount: 0,
      errors: ["Commissioner or Super Admin access is required to import schedule fixtures."],
    };
  }

  const supabase = await createSupabaseServerClient(true);

  // Fetch venue time zones for rinks
  const rinkIds = Array.from(new Set(games.map((g) => g.rinkId)));
  const { data: rinksData } = await supabase
    .from("rinks")
    .select("id, venue_id, venues(time_zone)")
    .in("id", rinkIds);

  const timeZoneMap = new Map<string, string>();
  (rinksData || []).forEach((r: any) => {
    timeZoneMap.set(r.id, r.venues?.time_zone || "America/Toronto");
  });

  const errors: string[] = [];
  let importedCount = 0;

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const timeZone = timeZoneMap.get(g.rinkId) || "America/Toronto";

    let startsAtUtc: string;
    let endsAtUtc: string;

    try {
      startsAtUtc = startInUtc(g.localStart, timeZone);
      const startMs = Date.parse(startsAtUtc);
      endsAtUtc = new Date(startMs + g.duration * 60000).toISOString();
    } catch (err: any) {
      errors.push(`Row ${i + 1}: Invalid date/time "${g.localStart}" (${err.message})`);
      continue;
    }

    const { error: insErr } = await supabase.from("games").upsert({
      id: g.id || crypto.randomUUID(),
      league_id: leagueId,
      home_entry_id: g.homeEntryId,
      away_entry_id: g.awayEntryId,
      rink_id: g.rinkId,
      starts_at: startsAtUtc,
      ends_at: endsAtUtc,
      status: g.status || "scheduled",
      revision: 1,
    });

    if (insErr) {
      errors.push(`Row ${i + 1}: Database error (${insErr.message})`);
    } else {
      importedCount++;
    }
  }

  revalidatePath("/schedule");
  revalidatePath(`/admin/league/${leagueId}`);

  return {
    success: importedCount > 0,
    importedCount,
    errors,
  };
}
