import {z} from "zod";
export const playerSchema=z.object({display_name:z.string().trim().min(2,"Enter at least two characters.").max(100)});
export const rosterSchema=z.object({
 team_entry_id:z.uuid(),
 player_id:z.uuid(),
 jersey_number:z.union([z.literal(""),z.string().regex(/^\d{1,2}$/)]).transform(value=>value===""?null:Number(value)),
 position:z.enum(["C","LW","RW","D","G","F"]),
 status:z.enum(["active","inactive"]),
 revision:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483646)),
});
export type RosterRow={id:string;player_id:string;jersey_number:number|null;position:string;status:"active"|"inactive";revision:number};
export type PlayerOption={id:string;display_name:string};

