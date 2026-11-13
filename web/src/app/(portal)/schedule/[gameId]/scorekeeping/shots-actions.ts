"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  recordPeriodShotsSchema,
  recordGoalieStintSchema,
} from "@/lib/shots-schema";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function recordPeriodShotsAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to record shots." };
  }

  const parse = recordPeriodShotsSchema.safeParse({
    gameId: formData.get("gameId"),
    teamEntryId: formData.get("teamEntryId"),
    period: formData.get("period"),
    shots: formData.get("shots"),
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid shot parameters.",
    };
  }

  const { gameId, teamEntryId, period, shots } = parse.data;

  const { error } = await supabase.rpc("record_period_shots", {
    target_game: gameId,
    target_team_entry: teamEntryId,
    target_period: period,
    shot_count: shots,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to record period shots.",
    };
  }

  revalidatePath(`/schedule/${gameId}/scorekeeping`);
  revalidatePath(`/schedule/${gameId}/live`);

  return {
    success: true,
    message: `Period ${period} shots updated (${shots} SOG).`,
  };
}

export async function recordGoalieStintAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to log goalie stint." };
  }

  const parse = recordGoalieStintSchema.safeParse({
    gameId: formData.get("gameId"),
    teamEntryId: formData.get("teamEntryId"),
    goalieId: formData.get("goalieId"),
    periodStart: formData.get("periodStart") || "1",
    clockStart: formData.get("clockStart") || "1200",
    periodEnd: formData.get("periodEnd") || undefined,
    clockEnd: formData.get("clockEnd") || undefined,
    emptyNet: formData.get("emptyNet") === "true",
    shotsFaced: formData.get("shotsFaced") || "0",
    goalsAllowed: formData.get("goalsAllowed") || "0",
    decision: formData.get("decision") || "ND",
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid goalie stint parameters.",
    };
  }

  const {
    gameId,
    teamEntryId,
    goalieId,
    periodStart,
    clockStart,
    periodEnd,
    clockEnd,
    emptyNet,
    shotsFaced,
    goalsAllowed,
    decision,
  } = parse.data;

  if (goalsAllowed > shotsFaced) {
    return {
      success: false,
      message: "Goals allowed cannot exceed shots faced.",
    };
  }

  const { error } = await supabase.rpc("record_goalie_stint", {
    target_game: gameId,
    target_team_entry: teamEntryId,
    target_goalie: goalieId,
    p_start: periodStart,
    c_start: clockStart,
    p_end: periodEnd ?? null,
    c_end: clockEnd ?? null,
    empty_net: emptyNet,
    shots_faced: shotsFaced,
    goals_allowed: goalsAllowed,
    goalie_decision: decision,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to record goalie stint.",
    };
  }

  revalidatePath(`/schedule/${gameId}/scorekeeping`);
  revalidatePath(`/schedule/${gameId}/live`);

  return {
    success: true,
    message: "Goaltender boxscore stint saved!",
  };
}

