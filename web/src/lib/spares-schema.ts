import { z } from "zod";

export interface SparePoolItem {
  pool_id: string;
  player_id: string;
  player_name: string;
  preferred_position: "F" | "D" | "G" | "any";
  skill_level: string;
  is_available: boolean;
  notes: string | null;
  is_suspended: boolean;
}

export interface GameCallupItem {
  callup_id: string;
  game_id: string;
  team_entry_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  player_position: "F" | "D" | "G";
  jersey_number: number | null;
  status: "requested" | "accepted" | "declined" | "cancelled";
  responded_at: string | null;
  created_at: string;
}

export const registerSpareSchema = z.object({
  playerId: z.string().uuid(),
  preferredPosition: z.enum(["F", "D", "G", "any"]),
  skillLevel: z.string().min(1).max(50).default("Intermediate"),
  isAvailable: z.coerce.boolean().default(true),
  notes: z.string().max(300).optional(),
});

export const requestCallupSchema = z.object({
  gameId: z.string().uuid(),
  teamEntryId: z.string().uuid(),
  playerId: z.string().uuid(),
  position: z.enum(["F", "D", "G"]),
  jerseyNumber: z.coerce.number().int().min(0).max(99).optional(),
});

export const respondCallupSchema = z.object({
  callupId: z.string().uuid(),
  accept: z.coerce.boolean(),
});

