"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  recordIncidentSchema,
  appealSuspensionSchema,
  resolveAppealSchema,
} from "@/lib/discipline-schema";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function recordIncidentAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, leagueId, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to log disciplinary incidents." };
  }

  const parse = recordIncidentSchema.safeParse({
    seasonId: formData.get("seasonId"),
    teamEntryId: formData.get("teamEntryId"),
    playerId: formData.get("playerId"),
    infraction: formData.get("infraction"),
    penaltyMinutes: formData.get("penaltyMinutes"),
    gamesSuspended: formData.get("gamesSuspended"),
    gameId: formData.get("gameId") || null,
    notes: formData.get("notes") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid incident details.",
    };
  }

  const { seasonId, teamEntryId, playerId, infraction, penaltyMinutes, gamesSuspended, gameId, notes } =
    parse.data;

  const { error } = await supabase.rpc("record_disciplinary_incident", {
    target_league: leagueId,
    target_season: seasonId,
    target_player: playerId,
    target_entry: teamEntryId,
    infraction_name: infraction,
    suspended_games: gamesSuspended,
    penalty_mins: penaltyMinutes,
    target_game: gameId,
    incident_notes: notes ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to record disciplinary incident.",
    };
  }

  revalidatePath("/league/discipline");
  revalidatePath("/teams");

  return {
    success: true,
    message: `Disciplinary incident recorded: ${gamesSuspended} game suspension applied.`,
  };
}

export async function appealSuspensionAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to submit an appeal." };
  }

  const parse = appealSuspensionSchema.safeParse({
    incidentId: formData.get("incidentId"),
    statement: formData.get("statement"),
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid appeal statement.",
    };
  }

  const { incidentId, statement } = parse.data;

  const { error } = await supabase.rpc("submit_suspension_appeal", {
    target_incident: incidentId,
    statement,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to submit suspension appeal.",
    };
  }

  revalidatePath("/league/discipline");

  return {
    success: true,
    message: "Appeal submitted successfully. Under commissioner review.",
  };
}

export async function resolveAppealAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to resolve appeals." };
  }

  const parse = resolveAppealSchema.safeParse({
    incidentId: formData.get("incidentId"),
    decision: formData.get("decision"),
    newSuspendedGames: formData.get("newSuspendedGames") || undefined,
    commissionerNotes: formData.get("commissionerNotes") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid appeal resolution.",
    };
  }

  const { incidentId, decision, newSuspendedGames, commissionerNotes } = parse.data;

  const { error } = await supabase.rpc("resolve_suspension_appeal", {
    target_incident: incidentId,
    decision,
    new_suspended_games: newSuspendedGames ?? null,
    commissioner_notes: commissionerNotes ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to resolve appeal.",
    };
  }

  revalidatePath("/league/discipline");
  revalidatePath("/teams");

  return {
    success: true,
    message: `Appeal resolved: Decision '${decision.toUpperCase()}' recorded.`,
  };
}
