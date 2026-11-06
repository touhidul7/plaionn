import {z} from "zod";
export const registrationSchema=z.object({season_id:z.uuid(),display_name:z.string().trim().min(2).max(100),position:z.enum(["C","LW","RW","D","G","F"])});
export const decisionSchema=z.object({registration_id:z.uuid(),decision:z.enum(["approved","rejected","withdrawn"]),revision:z.coerce.number().int().positive(),reason:z.string().trim().min(3).max(500)});
export const publicationSchema=z.object({season_id:z.uuid(),enabled:z.enum(["true","false"]),revision:z.coerce.number().int().positive()});
export const openSeasonsSchema=z.array(z.object({season_id:z.string(),league_name:z.string(),season_name:z.string(),opens:z.string(),closes:z.string()}));
export type OpenSeason=z.infer<typeof openSeasonsSchema>[number];
