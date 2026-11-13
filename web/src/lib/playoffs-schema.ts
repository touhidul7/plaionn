import { z } from "zod";

export interface PlayoffSeriesItem {
  id: string;
  round_number: number;
  series_order: number;
  high_seed_entry_id: string | null;
  high_seed_name: string;
  high_seed_rank: number | null;
  high_seed_wins: number;
  low_seed_entry_id: string | null;
  low_seed_name: string;
  low_seed_rank: number | null;
  low_seed_wins: number;
  winner_entry_id: string | null;
  winner_name: string | null;
  next_series_id: string | null;
  status: "scheduled" | "in_progress" | "completed";
}

export interface PlayoffTournamentDetails {
  tournament_id: string;
  league_id: string;
  division_id: string;
  season_id: string;
  name: string;
  format: "single_elimination" | "best_of_3";
  team_count: number;
  status: "draft" | "active" | "completed";
  series: PlayoffSeriesItem[];
}

export const generateBracketSchema = z.object({
  divisionId: z.string().uuid(),
  name: z.string().min(2).max(120),
  format: z.enum(["single_elimination", "best_of_3"]),
  teamCount: z.coerce.number().refine((n) => [2, 4, 8].includes(n), {
    message: "Team count must be 2, 4, or 8",
  }),
});

export const updateSeriesSchema = z.object({
  seriesId: z.string().uuid(),
  highWins: z.coerce.number().int().min(0).max(4),
  lowWins: z.coerce.number().int().min(0).max(4),
  winnerEntryId: z.string().uuid().nullable().optional(),
});

