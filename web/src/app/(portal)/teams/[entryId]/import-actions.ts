"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import { z } from "zod";

const importPayloadSchema = z.object({
  entryId: z.string().uuid(),
  players: z.array(
    z.object({
      name: z.string().min(2).max(100),
      jersey: z.number().int().min(0).max(99).nullable(),
      position: z.enum(["F", "D", "G", "C", "LW", "RW"]),
    })
  ).min(1),
});

export interface ImportActionResult {
  success: boolean;
  message: string;
  importedCount?: number;
  updatedCount?: number;
}

export async function submitBulkRosterImportAction(
  _prevState: ImportActionResult | null,
  formData: FormData
): Promise<ImportActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to import rosters." };
  }

  const rawJson = formData.get("playersJson");
  const entryId = formData.get("entryId");

  if (!rawJson || typeof rawJson !== "string") {
    return { success: false, message: "Missing player roster data." };
  }

  let parsedData: unknown;
  try {
    parsedData = JSON.parse(rawJson);
  } catch {
    return { success: false, message: "Malformed player JSON data." };
  }

  const validation = importPayloadSchema.safeParse({
    entryId,
    players: parsedData,
  });

  if (!validation.success) {
    return {
      success: false,
      message: validation.error.issues.map((i) => i.message).join(", ") || "Invalid import payload.",
    };
  }

  const { error, data } = await supabase.rpc("bulk_import_roster", {
    target_entry: validation.data.entryId,
    rows: validation.data.players,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to import roster.",
    };
  }

  revalidatePath(`/teams/${entryId}`);
  revalidatePath("/teams");

  const summary = data as { imported_count?: number; updated_count?: number; total_roster_count?: number };

  return {
    success: true,
    message: `Successfully imported ${summary?.imported_count ?? 0} new players (${summary?.updated_count ?? 0} updated). Total active roster: ${summary?.total_roster_count ?? 0}.`,
    importedCount: summary?.imported_count,
    updatedCount: summary?.updated_count,
  };
}

