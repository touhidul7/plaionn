"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import { saveRsvpSchema } from "@/lib/attendance-schema";

export interface RsvpActionResult {
  success: boolean;
  message: string;
}

export async function submitRsvpAction(
  _prevState: RsvpActionResult | null,
  formData: FormData
): Promise<RsvpActionResult> {
  const { supabase, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to RSVP." };
  }

  const parse = saveRsvpSchema.safeParse({
    gameId: formData.get("gameId"),
    playerId: formData.get("playerId"),
    status: formData.get("status"),
    note: formData.get("note") || "",
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid RSVP data.",
    };
  }

  const { gameId, playerId, status, note } = parse.data;

  const { error } = await supabase.rpc("save_game_rsvp", {
    target_game: gameId,
    target_player: playerId,
    rsvp_status: status,
    rsvp_note: note,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to save RSVP.",
    };
  }

  revalidatePath(`/schedule/${gameId}/rsvp`);
  revalidatePath(`/schedule/${gameId}/live`);
  revalidatePath("/schedule");

  return {
    success: true,
    message: `RSVP updated: ${status.toUpperCase()}`,
  };
}

