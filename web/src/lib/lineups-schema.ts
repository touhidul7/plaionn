import { z } from "zod";

export const LINE_SLOTS = [
  { key: "F1_LW", label: "Line 1 Left Wing (LW)", group: "F1", pos: "LW" },
  { key: "F1_C", label: "Line 1 Center (C)", group: "F1", pos: "C" },
  { key: "F1_RW", label: "Line 1 Right Wing (RW)", group: "F1", pos: "RW" },

  { key: "F2_LW", label: "Line 2 Left Wing (LW)", group: "F2", pos: "LW" },
  { key: "F2_C", label: "Line 2 Center (C)", group: "F2", pos: "C" },
  { key: "F2_RW", label: "Line 2 Right Wing (RW)", group: "F2", pos: "RW" },

  { key: "F3_LW", label: "Line 3 Left Wing (LW)", group: "F3", pos: "LW" },
  { key: "F3_C", label: "Line 3 Center (C)", group: "F3", pos: "C" },
  { key: "F3_RW", label: "Line 3 Right Wing (RW)", group: "F3", pos: "RW" },

  { key: "D1_LD", label: "Pair 1 Left Defense (LD)", group: "D1", pos: "LD" },
  { key: "D1_RD", label: "Pair 1 Right Defense (RD)", group: "D1", pos: "RD" },

  { key: "D2_LD", label: "Pair 2 Left Defense (LD)", group: "D2", pos: "LD" },
  { key: "D2_RD", label: "Pair 2 Right Defense (RD)", group: "D2", pos: "RD" },

  { key: "D3_LD", label: "Pair 3 Left Defense (LD)", group: "D3", pos: "LD" },
  { key: "D3_RD", label: "Pair 3 Right Defense (RD)", group: "D3", pos: "RD" },

  { key: "G_STARTER", label: "Starting Goaltender (G1)", group: "G", pos: "G" },
  { key: "G_BACKUP", label: "Backup Goaltender (G2)", group: "G", pos: "G" },
  { key: "SCRATCH", label: "Healthy Scratch / Inactive", group: "SCRATCH", pos: "SCRATCH" },
] as const;

export type LineSlotKey = (typeof LINE_SLOTS)[number]["key"];

export interface LineupPlayer {
  player_id: string;
  display_name: string;
  jersey_number: number | null;
  line_assignment: LineSlotKey;
  player_position: string;
  rsvp_status: string;
}

export const lineupPlayerSchema = z.object({
  player_id: z.string().uuid(),
  display_name: z.string(),
  jersey_number: z.number().nullable(),
  line_assignment: z.string(),
  player_position: z.string(),
  rsvp_status: z.string(),
});
