"use server";

import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/supabase/session";

export interface NotifState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function savePreferencesAction(
  prevState: NotifState,
  formData: FormData
): Promise<NotifState> {
  const phone = (formData.get("phone") as string) || null;
  const smsOn = formData.get("smsOn") === "on";
  const pushOn = formData.get("pushOn") === "on";
  const emailOn = formData.get("emailOn") === "on";

  const remindersOn = formData.get("remindersOn") === "on";
  const schedOn = formData.get("schedOn") === "on";
  const sparesOn = formData.get("sparesOn") === "on";
  const announcementsOn = formData.get("announcementsOn") === "on";
  const disciplineOn = formData.get("disciplineOn") === "on";

  const quietOn = formData.get("quietOn") === "on";
  const quietStart = (formData.get("quietStart") as string) || "22:00";
  const quietEnd = (formData.get("quietEnd") as string) || "08:00";
  const tz = (formData.get("timezone") as string) || "America/Toronto";

  const { supabase, league } = await getLeagueContext();

  const { error } = await supabase.rpc("save_notification_preferences", {
    target_league: league.id,
    new_phone: phone,
    sms_on: smsOn,
    push_on: pushOn,
    email_on: emailOn,
    reminders_on: remindersOn,
    sched_on: schedOn,
    spares_on: sparesOn,
    announcements_on: announcementsOn,
    discipline_on: disciplineOn,
    quiet_on: quietOn,
    q_start: quietStart,
    q_end: quietEnd,
    tz: tz,
  });

  if (error) {
    return { status: "error", message: error.message || "Failed to save preferences" };
  }

  revalidatePath("/account/notifications");
  return { status: "success", message: "Notification & SMS preferences updated successfully!" };
}
