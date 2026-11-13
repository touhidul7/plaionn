import { z } from "zod";

export const rsvpStatusEnum = z.enum(["attending", "out", "tentative"]);
export type RsvpStatus = z.infer<typeof rsvpStatusEnum>;

export const saveRsvpSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: rsvpStatusEnum,
  note: z.string().max(150).optional().default(""),
});

export type SaveRsvpInput = z.infer<typeof saveRsvpSchema>;

export interface PlayerAttendanceRecord {
  player_id: string;
  display_name: string;
  jersey_number: number | null;
  player_position: string;
  rsvp_status: "attending" | "out" | "tentative" | "unconfirmed";
  note: string;
  updated_at: string | null;
}

export interface AttendanceHeadcount {
  attendingSkaters: number;
  attendingGoalies: number;
  out: number;
  tentative: number;
  unconfirmed: number;
  totalRoster: number;
}

export function computeHeadcount(records: PlayerAttendanceRecord[]): AttendanceHeadcount {
  let attendingSkaters = 0;
  let attendingGoalies = 0;
  let out = 0;
  let tentative = 0;
  let unconfirmed = 0;

  for (const record of records) {
    if (record.rsvp_status === "attending") {
      if (record.player_position === "G") {
        attendingGoalies += 1;
      } else {
        attendingSkaters += 1;
      }
    } else if (record.rsvp_status === "out") {
      out += 1;
    } else if (record.rsvp_status === "tentative") {
      tentative += 1;
    } else {
      unconfirmed += 1;
    }
  }

  return {
    attendingSkaters,
    attendingGoalies,
    out,
    tentative,
    unconfirmed,
    totalRoster: records.length,
  };
}

