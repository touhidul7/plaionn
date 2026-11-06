import {z} from "zod";
export const officialSchema=z.object({
 game_id:z.uuid(),slot:z.enum(["timekeeper","referee_1","referee_2"]),
 user_id:z.union([z.uuid(),z.literal("")]),
 revision:z.coerce.number().int().positive(),reason:z.string().trim().min(3).max(500),
});
export type Official={user_id:string;role:string;label:string};
export type Assignment={slot:string;user_id:string};
export const officialSlots=[{id:"timekeeper",label:"Timekeeper",role:"timekeeper"},{id:"referee_1",label:"Referee 1",role:"referee"},{id:"referee_2",label:"Referee 2",role:"referee"}];
