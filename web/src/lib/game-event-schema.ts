import {z} from "zod";

const clock=z.string().regex(/^\d{1,2}:[0-5]\d$/,"Enter the clock as minutes:seconds.").transform(value=>{
 const [minutes,seconds]=value.split(":").map(Number);
 return minutes*60+seconds;
});
const optionalUuid=z.union([z.literal(""),z.uuid()]).transform(value=>value||null);
export const gameEventSchema=z.object({
 game_id:z.uuid(),
 client_event_id:z.uuid(),
 event_kind:z.enum(["goal","penalty"]),
 team_entry_id:z.uuid(),
 period:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10)),
 clock_remaining:clock,
 player_id:z.uuid(),
 assist_one_id:optionalUuid,
 assist_two_id:optionalUuid,
 penalty_minutes:z.union([z.literal(""),z.enum(["2","4","5","10"])]).transform(value=>value?Number(value):null),
}).superRefine((value,context)=>{
 if(value.event_kind==="goal"&&value.penalty_minutes!==null){
  context.addIssue({code:"custom",message:"Goals cannot have penalty minutes.",path:["penalty_minutes"]});
 }
 if(value.event_kind==="penalty"&&(value.penalty_minutes===null||value.assist_one_id!==null||value.assist_two_id!==null)){
  context.addIssue({code:"custom",message:"Penalties need a duration and cannot have assists.",path:["penalty_minutes"]});
 }
 if(value.assist_one_id&&value.assist_one_id===value.player_id||value.assist_two_id&&(value.assist_two_id===value.player_id||value.assist_two_id===value.assist_one_id)){
  context.addIssue({code:"custom",message:"Scorer and assists must be different players.",path:["assist_two_id"]});
 }
});
export const voidGameEventSchema=z.object({
 game_id:z.uuid(),
 event_id:z.uuid(),
 reason:z.string().trim().min(3).max(500),
});
export const gameScoreRosterMemberSchema=z.object({
 team_entry_id:z.uuid(),
 player_id:z.uuid(),
 display_name:z.string(),
 position:z.string(),
 jersey_number:z.number().int().nullable(),
});
export type GameScoreRosterMember={team_entry_id:string;player_id:string;display_name:string;position:string;jersey_number:number|null};
export type GameEvent={id:string;client_event_id:string;event_kind:"goal"|"penalty";team_entry_id:string;period:number;clock_seconds_remaining:number;player_id:string;assist_one_id:string|null;assist_two_id:string|null;penalty_minutes:number|null;recorded_by:string;recorded_at:string};
