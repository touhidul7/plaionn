import { z } from "zod";

export interface FreeAgentProfileItem {
  profile_id: string;
  player_id: string;
  player_name: string;
  preferred_position: "F" | "D" | "G" | "any";
  skill_level: string;
  preferred_division_name: string | null;
  bio: string | null;
  status: "seeking" | "placed" | "inactive";
  created_at: string;
}

export interface TeamVacancyItem {
  vacancy_id: string;
  team_entry_id: string;
  team_name: string;
  division_name: string;
  needed_positions: string[];
  description: string;
  spots_available: number;
  is_active: boolean;
  applicant_count: number;
  created_at: string;
}

export const registerFreeAgentSchema = z.object({
  playerId: z.string().uuid(),
  position: z.enum(["F", "D", "G", "any"]),
  skillLevel: z.string().min(1).max(50).default("Intermediate"),
  preferredDivisionId: z.string().uuid().nullable().optional(),
  bio: z.string().max(500).optional(),
});

export const postVacancySchema = z.object({
  teamEntryId: z.string().uuid(),
  positions: z.array(z.string()).min(1, "Select at least one position needed"),
  description: z.string().min(2, "Description must be at least 2 characters"),
  spotsAvailable: z.coerce.number().int().min(1).default(1),
});

export const applyVacancySchema = z.object({
  vacancyId: z.string().uuid(),
  playerId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

export const reviewApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  accept: z.coerce.boolean(),
  assignedJersey: z.coerce.number().int().min(0).max(99).optional(),
});

