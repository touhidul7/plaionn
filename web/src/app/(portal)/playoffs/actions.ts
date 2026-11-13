"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import { generateBracketSchema, updateSeriesSchema } from "@/lib/playoffs-schema";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function generateBracketAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to generate playoff brackets." };
  }

  const parse = generateBracketSchema.safeParse({
    divisionId: formData.get("divisionId"),
    name: formData.get("name"),
    format: formData.get("format"),
    teamCount: formData.get("teamCount"),
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid bracket parameters.",
    };
  }

  const { divisionId, name, format, teamCount } = parse.data;

  const { error } = await supabase.rpc("generate_playoff_bracket", {
    target_division: divisionId,
    tournament_name: name,
    playoff_format: format,
    team_count: teamCount,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to generate playoff bracket.",
    };
  }

  revalidatePath("/playoffs");
  revalidatePath("/standings");

  return {
    success: true,
    message: `Generated ${teamCount}-team playoff bracket: "${name}".`,
  };
}

export async function updateSeriesScoreAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to update playoff series." };
  }

  const parse = updateSeriesSchema.safeParse({
    seriesId: formData.get("seriesId"),
    highWins: formData.get("highWins"),
    lowWins: formData.get("lowWins"),
    winnerEntryId: formData.get("winnerEntryId") || null,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid series scores.",
    };
  }

  const { seriesId, highWins, lowWins, winnerEntryId } = parse.data;

  // Determine series status
  const isCompleted = winnerEntryId !== null;
  const status = isCompleted ? "completed" : highWins > 0 || lowWins > 0 ? "in_progress" : "scheduled";

  const { error } = await supabase
    .from("playoff_series")
    .update({
      high_seed_wins: highWins,
      low_seed_wins: lowWins,
      winner_entry_id: winnerEntryId,
      status,
    })
    .eq("id", seriesId);

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to update series.",
    };
  }

  // If winner declared, advance winner
  if (winnerEntryId) {
    await supabase.rpc("advance_playoff_series_winner", {
      target_series: seriesId,
    });
  }

  revalidatePath("/playoffs");
  revalidatePath("/standings");

  return {
    success: true,
    message: isCompleted ? "Series completed and winner advanced!" : "Series score updated.",
  };
}

