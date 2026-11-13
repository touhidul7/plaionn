import { z } from "zod";

export interface AnnouncementItem {
  announcement_id: string;
  league_id: string;
  team_entry_id: string | null;
  team_name: string | null;
  title: string;
  message: string;
  priority: "urgent" | "important" | "standard";
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
}

export const publishAnnouncementSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(150),
  message: z.string().min(2, "Message must be at least 2 characters"),
  priority: z.enum(["urgent", "important", "standard"]).default("standard"),
  teamEntryId: z.string().uuid().nullable().optional(),
  isPinned: z.coerce.boolean().default(false),
  expiresHours: z.coerce.number().int().min(0).optional(),
});

export const deleteAnnouncementSchema = z.object({
  announcementId: z.string().uuid(),
});

