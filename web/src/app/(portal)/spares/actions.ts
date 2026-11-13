"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  registerSpareSchema,
  requestCallupSchema,
  respondCallupSchema,
} from "@/lib/spares-schema";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function registerSpareAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, leagueId, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to join the spare pool." };
  }

  const parse = registerSpareSchema.safeParse({
    playerId: formData.get("playerId"),
    preferredPosition: formData.get("preferredPosition"),
    skillLevel: formData.get("skillLevel") || "Intermediate",
    isAvailable: formData.get("isAvailable") === "true" || formData.get("isAvailable") === "on",
    notes: formData.get("notes") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid spare profile details.",
    };
  }

  const { playerId, preferredPosition, skillLevel, isAvailable, notes } = parse.data;

  const { error } = await supabase.rpc("register_spare_availability", {
    target_league: leagueId,
    target_player: playerId,
    target_position: preferredPosition,
    skill: skillLevel,
    available: isAvailable,
    spare_notes: notes ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to update spare profile.",
    };
  }

  revalidatePath("/spares");

  return {
    success: true,
    message: isAvailable
      ? "You are now listed in the League Spare Pool!"
      : "Your status has been updated to unavailable.",
  };
}

export async function requestCallupAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner or captain access required to dispatch call-ups." };
  }

  const parse = requestCallupSchema.safeParse({
    gameId: formData.get("gameId"),
    teamEntryId: formData.get("teamEntryId"),
    playerId: formData.get("playerId"),
    position: formData.get("position"),
    jerseyNumber: formData.get("jerseyNumber") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid call-up parameters.",
    };
  }

  const { gameId, teamEntryId, playerId, position, jerseyNumber } = parse.data;

  const { error } = await supabase.rpc("request_game_callup", {
    target_game: gameId,
    target_entry: teamEntryId,
    target_player: playerId,
    target_position: position,
    jersey_num: jerseyNumber ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to dispatch call-up request.",
    };
  }

  revalidatePath("/spares");
  revalidatePath("/schedule");

  return {
    success: true,
    message: "Game day call-up request dispatched to spare player!",
  };
}

export async function respondCallupAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to respond." };
  }

  const parse = respondCallupSchema.safeParse({
    callupId: formData.get("callupId"),
    accept: formData.get("accept") === "true",
  });

  if (!parse.success) {
    return {
      success: false,
      message: "Invalid response data.",
    };
  }

  const { callupId, accept } = parse.data;

  const { error } = await supabase.rpc("respond_to_callup", {
    target_callup: callupId,
    accept,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to respond to call-up.",
    };
  }

  revalidatePath("/spares");
  revalidatePath("/schedule");

  return {
    success: true,
    message: accept ? "Call-up accepted! You are confirmed for this game." : "Call-up declined.",
  };
}

