"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";
import {
  publishAnnouncementSchema,
  deleteAnnouncementSchema,
} from "@/lib/announcements-schema";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function publishAnnouncementAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, leagueId, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to post announcements." };
  }

  const parse = publishAnnouncementSchema.safeParse({
    title: formData.get("title"),
    message: formData.get("message"),
    priority: formData.get("priority") || "standard",
    teamEntryId: formData.get("teamEntryId") || null,
    isPinned: formData.get("isPinned") === "true" || formData.get("isPinned") === "on",
    expiresHours: formData.get("expiresHours") || undefined,
  });

  if (!parse.success) {
    return {
      success: false,
      message: parse.error.issues.map((i) => i.message).join(", ") || "Invalid announcement details.",
    };
  }

  const { title, message, priority, teamEntryId, isPinned, expiresHours } = parse.data;

  const expireTime =
    expiresHours && expiresHours > 0
      ? new Date(Date.now() + expiresHours * 3600 * 1000).toISOString()
      : null;

  const { error } = await supabase.rpc("publish_announcement", {
    target_league: leagueId,
    notice_title: title,
    notice_message: message,
    notice_priority: priority,
    target_entry: teamEntryId ?? null,
    pinned: isPinned,
    expire_time: expireTime,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to post announcement.",
    };
  }

  revalidatePath("/announcements");
  revalidatePath("/");

  return {
    success: true,
    message: `Announcement "${title}" published!`,
  };
}

export async function deleteAnnouncementAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, canManage } = await getLeagueContext();
  if (!canManage) {
    return { success: false, message: "Commissioner access required to remove announcements." };
  }

  const parse = deleteAnnouncementSchema.safeParse({
    announcementId: formData.get("announcementId"),
  });

  if (!parse.success) {
    return { success: false, message: "Invalid announcement ID." };
  }

  const { announcementId } = parse.data;

  const { error } = await supabase.rpc("delete_announcement", {
    target_announcement: announcementId,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Failed to remove announcement.",
    };
  }

  revalidatePath("/announcements");
  revalidatePath("/");

  return {
    success: true,
    message: "Announcement removed.",
  };
}

