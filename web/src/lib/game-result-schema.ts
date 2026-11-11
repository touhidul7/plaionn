import {z} from "zod";

const reason=z.string().trim().min(3).max(500);
export const gameResultSubmitSchema=z.object({
 game_id:z.uuid(),
 decision:z.enum(["regulation","overtime","shootout","tie"]),
 reason:z.union([z.literal(""),reason]).transform(value=>value||null),
});
export const gameResultReviewSchema=z.object({
 game_id:z.uuid(),
 decision:z.enum(["approve","correction"]),
 reason,
});
export const gameResultReopenSchema=z.object({
 game_id:z.uuid(),
 reason,
});
