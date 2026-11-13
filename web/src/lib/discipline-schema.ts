import { z } from "zod";

export interface DisciplineIncidentItem {
  incident_id: string;
  league_id: string;
  season_id: string;
  game_id: string | null;
  player_id: string;
  player_name: string;
  jersey_number: number | null;
  team_entry_id: string;
  team_name: string;
  infraction: string;
  penalty_minutes: number;
  games_suspended: number;
  games_served: number;
  games_remaining: number;
  status: "active" | "served" | "appealed" | "revoked";
  incident_date: string;
  notes: string | null;
  appeal_notes: string | null;
  appeal_status: "pending" | "upheld" | "reduced" | "overturned" | null;
  created_at: string;
}

export const recordIncidentSchema = z.object({
  seasonId: z.string().uuid(),
  teamEntryId: z.string().uuid(),
  playerId: z.string().uuid(),
  infraction: z.string().min(2, "Infraction must be at least 2 characters").max(120),
  penaltyMinutes: z.coerce.number().int().min(0).default(0),
  gamesSuspended: z.coerce.number().int().min(0, "Games suspended cannot be negative"),
  gameId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const appealSuspensionSchema = z.object({
  incidentId: z.string().uuid(),
  statement: z.string().min(5, "Appeal statement must be at least 5 characters").max(1000),
});

export const resolveAppealSchema = z.object({
  incidentId: z.string().uuid(),
  decision: z.enum(["upheld", "reduced", "overturned"]),
  newSuspendedGames: z.coerce.number().int().min(0).optional(),
  commissionerNotes: z.string().max(500).optional(),
});
