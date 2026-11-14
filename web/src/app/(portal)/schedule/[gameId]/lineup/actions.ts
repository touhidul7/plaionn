"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";

export interface SaveLineupState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function saveGameLineupAction(
  prevState: SaveLineupState,
  formData: FormData
): Promise<SaveLineupState> {
  const gameId = formData.get("gameId") as string;
  const teamEntryId = formData.get("teamEntryId") as string;
  const assignmentsRaw = formData.get("assignments") as string;

  if (!gameId || !teamEntryId || !assignmentsRaw) {
    return { status: "error", message: "Missing required lineup data" };
  }

  let assignments: any[];
  try {
    assignments = JSON.parse(assignmentsRaw);
  } catch {
    return { status: "error", message: "Invalid lineup format" };
  }

  const { supabase, canManage } = await getLeagueContext();

  const { data, error } = await supabase.rpc("save_game_lineup", {
    target_game: gameId,
    target_entry: teamEntryId,
    assignments,
  });

  if (error) {
    return {
      status: "error",
      message: error.message || "Could not save lineup. Please check permissions.",
    };
  }

  revalidatePath(`/schedule/${gameId}/lineup`);
  revalidatePath(`/schedule/${gameId}/live`);
  return { status: "success", message: `Lineup saved successfully (${data} players assigned)` };
}
