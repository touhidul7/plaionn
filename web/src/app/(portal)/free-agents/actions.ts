"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  registerFreeAgentSchema,
  postVacancySchema,
  applyVacancySchema,
  reviewApplicationSchema,
} from "@/lib/free-agents-schema";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function registerFreeAgentAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, leagueId, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to register as a free agent." };
  }

  const parse = registerFreeAgentSchema.safeParse({
    playerId: formData.get("playerId"),
    position: formData.get("position"),
    skillLevel: formData.get("skillLevel") || "Intermediate",
    preferredDivisionId: formData.get("preferredDivisionId") || null,
    bio: formData.get("bio") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid profile data.",
    };
  }

  const { playerId, position, skillLevel, preferredDivisionId, bio } = parse.data;

  const { error } = await supabase.rpc("register_free_agent", {
    target_league: leagueId,
    target_player: playerId,
    target_position: position,
    skill: skillLevel,
    pref_division: preferredDivisionId ?? null,
    agent_bio: bio ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to register free agent profile.",
    };
  }

  revalidatePath("/free-agents");

  return {
    success: true,
    message: "Free agent profile published! Teams and commissioners can now discover you.",
  };
}

export async function postVacancyAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to post team vacancies." };
  }

  const positions = formData.getAll("positions") as string[];

  const parse = postVacancySchema.safeParse({
    teamEntryId: formData.get("teamEntryId"),
    positions,
    description: formData.get("description"),
    spotsAvailable: formData.get("spotsAvailable") || "1",
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid vacancy parameters.",
    };
  }

  const { teamEntryId, description, spotsAvailable } = parse.data;

  const { error } = await supabase.rpc("post_team_vacancy", {
    target_entry: teamEntryId,
    positions_array: positions,
    vacancy_desc: description,
    open_spots: spotsAvailable,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to post team vacancy.",
    };
  }

  revalidatePath("/free-agents");

  return {
    success: true,
    message: "Team vacancy listing published!",
  };
}

export async function applyVacancyAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await getLeagueContext();
  if (!user) {
    return { success: false, message: "Authentication required to apply to a team." };
  }

  const parse = applyVacancySchema.safeParse({
    vacancyId: formData.get("vacancyId"),
    playerId: formData.get("playerId"),
    message: formData.get("message") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid application.",
    };
  }

  const { vacancyId, playerId, message } = parse.data;

  const { error } = await supabase.rpc("apply_to_vacancy", {
    target_vacancy: vacancyId,
    target_player: playerId,
    app_message: message ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to submit application.",
    };
  }

  revalidatePath("/free-agents");

  return {
    success: true,
    message: "Application submitted to team leadership!",
  };
}

export async function reviewApplicationAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to review applications." };
  }

  const parse = reviewApplicationSchema.safeParse({
    applicationId: formData.get("applicationId"),
    accept: formData.get("accept") === "true",
    assignedJersey: formData.get("assignedJersey") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: "Invalid review parameters.",
    };
  }

  const { applicationId, accept, assignedJersey } = parse.data;

  const { error } = await supabase.rpc("review_vacancy_application", {
    target_application: applicationId,
    accept,
    assigned_jersey: assignedJersey ?? null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to process application.",
    };
  }

  revalidatePath("/free-agents");
  revalidatePath("/teams");

  return {
    success: true,
    message: accept
      ? "Player accepted and automatically placed on the active roster!"
      : "Application declined.",
  };
}

