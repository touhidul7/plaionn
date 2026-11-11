import {z} from "zod";

export const liveScoreboardSchema=z.object({
 game_id:z.uuid(),
 home_entry_id:z.uuid(),
 away_entry_id:z.uuid(),
 home_score:z.number().int().nonnegative(),
 away_score:z.number().int().nonnegative(),
 events:z.array(z.object({
  id:z.uuid(),
  event_kind:z.enum(["goal","penalty"]),
  team_entry_id:z.uuid(),
  period:z.number().int().positive(),
  clock_seconds_remaining:z.number().int().nonnegative(),
  penalty_minutes:z.number().int().nullable(),
  recorded_at:z.iso.datetime({offset:true}),
 })),
 snapshot_at:z.iso.datetime({offset:true}),
});
export type LiveScoreboardData=z.infer<typeof liveScoreboardSchema>;

export const clockLabel=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
