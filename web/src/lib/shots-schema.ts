import { z } from "zod";

export interface TeamPeriodShots {
  team_entry_id: string;
  team_name: string;
  p1: number;
  p2: number;
  p3: number;
  ot: number;
  total: number;
}

export interface GoalieBoxscoreItem {
  stint_id: string;
  team_entry_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  shots_against: number;
  goals_against: number;
  saves: number;
  save_percentage: number;
  is_empty_net: boolean;
  decision: "W" | "L" | "OTL" | "ND" | null;
}

export interface GameShotsSummary {
  game_id: string;
  home_entry_id: string;
  away_entry_id: string;
  home_name: string;
  away_name: string;
  period_shots: TeamPeriodShots[];
  goalies: GoalieBoxscoreItem[];
}

export const recordPeriodShotsSchema = z.object({
  gameId: z.string().uuid(),
  teamEntryId: z.string().uuid(),
  period: z.coerce.number().int().min(1).max(10),
  shots: z.coerce.number().int().min(0).max(150),
});

export const recordGoalieStintSchema = z.object({
  gameId: z.string().uuid(),
  teamEntryId: z.string().uuid(),
  goalieId: z.string().uuid(),
  periodStart: z.coerce.number().int().min(1).default(1),
  clockStart: z.coerce.number().int().min(0).default(1200),
  periodEnd: z.coerce.number().int().min(1).optional(),
  clockEnd: z.coerce.number().int().min(0).optional(),
  emptyNet: z.coerce.boolean().default(false),
  shotsFaced: z.coerce.number().int().min(0).default(0),
  goalsAllowed: z.coerce.number().int().min(0).default(0),
  decision: z.enum(["W", "L", "OTL", "ND"]).default("ND"),
});

