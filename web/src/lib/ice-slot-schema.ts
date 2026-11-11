import {z} from "zod";
import {Temporal} from "@js-temporal/polyfill";

const localDateTime=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(value=>{
 try{Temporal.PlainDateTime.from(value);return true;}catch{return false;}
},"Use a valid local date and time.");
export const iceSlotSchema=z.object({
 division_id:z.uuid(),
 rink_id:z.uuid(),
 contract_id:z.union([z.literal(""),z.uuid()]).default(""),
 local_start:localDateTime,
 local_end:localDateTime,
 time_tier:z.enum(["early","prime","late"]),
 required:z.enum(["true","false"]).transform(value=>value==="true"),
}).refine(value=>{
 try{return Temporal.PlainDateTime.compare(value.local_start,value.local_end)<0;}
 catch{return false;}
},{message:"Slot end must be after its start.",path:["local_end"]})
 .refine(value=>{
  try{return Temporal.PlainDateTime.from(value.local_start).toPlainDate().equals(Temporal.PlainDateTime.from(value.local_end).toPlainDate());}
  catch{return false;}
 },{message:"An ice slot must start and end on the same local date.",path:["local_end"]});
export const blackoutSchema=z.object({entry_id:z.uuid(),blackout_date:z.iso.date()});
export const scheduleGenerationSchema=z.object({
 division_id:z.uuid(),
 start_date:z.iso.date(),
 end_date:z.iso.date(),
 round_robins:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(4)),
 max_games_per_week:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(7)),
 min_rest_hours:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(168)),
 preferred_weekdays:z.array(z.string().regex(/^[1-7]$/).transform(Number)).default([]),
 replace_existing_drafts:z.enum(["true","false"]).transform(value=>value==="true"),
}).refine(value=>value.start_date<=value.end_date,{message:"Season end date must be on or after the start date.",path:["end_date"]});
export const schedulePublishSchema=z.object({
 division_id:z.uuid(),
 start_date:z.iso.date(),
 end_date:z.iso.date(),
 confirm:z.literal("yes"),
}).refine(value=>value.start_date<=value.end_date,{message:"Season end date must be on or after the start date.",path:["end_date"]});

export type IceSlotRecord={id:string;division_id:string;rink_id:string;starts_at:string;ends_at:string;local_date:string;time_tier:"early"|"prime"|"late";is_required:boolean};
export type ScheduleBlackout={division_id:string;team_entry_id:string;blackout_date:string};
