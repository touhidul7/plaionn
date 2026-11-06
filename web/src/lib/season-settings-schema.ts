import {z} from "zod";

const integer=(min:number,max:number)=>z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));
const money=z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount with at most two decimal places.").transform(value=>{
 const [whole,fraction=""]=value.split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}).pipe(z.number().int().min(0).max(100000000));
const date=z.union([z.literal(""),z.iso.date()]).transform(value=>value||null);
const tiebreaker=z.enum(["wins","head_to_head","goal_difference","goals_for","fewest_penalties"]);
export const settingsSchema=z.object({
 season_id:z.uuid(),
 revision:integer(0,2147483647),
 roster_limit:integer(1,100),
 period_count:integer(1,10),
 period_minutes:integer(1,60),
 clock_mode:z.enum(["running","stop"]),
 win_points:integer(0,10),
 tie_points:integer(0,10),
 loss_points:integer(0,10),
 overtime_loss_points:integer(0,10),
 billing_model:z.enum(["team","player","both"]),
 currency:z.enum(["CAD","USD"]),
 team_fee_cents:money,
 player_fee_cents:money,
 registration_opens:date,
 registration_closes:date,
 tiebreaker_priority_1:tiebreaker,
 tiebreaker_priority_2:tiebreaker,
 tiebreaker_priority_3:tiebreaker,
 tiebreaker_priority_4:tiebreaker,
 tiebreaker_priority_5:tiebreaker,
}).refine(value=>!value.registration_opens||!value.registration_closes||value.registration_opens<=value.registration_closes,{
 message:"Registration closing date cannot be before opening date.",path:["registration_closes"],
}).superRefine((value,context)=>{
 const priorities=[value.tiebreaker_priority_1,value.tiebreaker_priority_2,value.tiebreaker_priority_3,value.tiebreaker_priority_4,value.tiebreaker_priority_5];
 if(new Set(priorities).size!==priorities.length) context.addIssue({code:"custom",message:"Each standings tiebreaker must appear exactly once.",path:["tiebreaker_priority_5"]});
}).transform(({tiebreaker_priority_1,tiebreaker_priority_2,tiebreaker_priority_3,tiebreaker_priority_4,tiebreaker_priority_5,...settings})=>({
 ...settings,
 standings_tiebreakers:[tiebreaker_priority_1,tiebreaker_priority_2,tiebreaker_priority_3,tiebreaker_priority_4,tiebreaker_priority_5],
}));
export type SeasonSettings=z.output<typeof settingsSchema>;
