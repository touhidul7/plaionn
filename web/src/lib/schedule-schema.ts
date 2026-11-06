import {z} from "zod";
import {Temporal} from "@js-temporal/polyfill";
export const venueSchema=z.object({
 name:z.string().trim().min(2).max(100),address:z.string().trim().max(300),
 time_zone:z.string().trim().min(1).max(100).refine(zone=>{try{new Intl.DateTimeFormat("en",{timeZone:zone});return true;}catch{return false;}},"Use a valid time zone, such as America/Toronto."),
 rink_name:z.string().trim().min(1).max(100),
});
export const rinkSchema=z.object({venue_id:z.uuid(),name:z.string().trim().min(1).max(100)});
export const gameSchema=z.object({
 id:z.uuid(),home_entry_id:z.uuid(),away_entry_id:z.uuid(),rink_id:z.uuid(),
 local_start:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
 duration:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(15).max(360)),
 status:z.enum(["draft","scheduled","cancelled"]),
 revision:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483646)),
 reason:z.string().trim().max(500),
}).refine(v=>v.home_entry_id!==v.away_entry_id,{message:"Choose two different teams.",path:["away_entry_id"]})
.refine(v=>v.revision===0||v.reason.length>=3,{message:"Enter a reason for changing this game.",path:["reason"]});
export function startInUtc(local:string,zone:string){
 return Temporal.PlainDateTime.from(local).toZonedDateTime(zone,{disambiguation:"reject"}).toInstant().toString();
}
export function localGameTime(utc:string,zone:string){
 return Temporal.Instant.from(utc).toZonedDateTimeISO(zone).toPlainDateTime().toString({smallestUnit:"minute"});
}
export type Venue={id:string;name:string;address:string;time_zone:string};
export type Rink={id:string;name:string;venue_id:string};
export type Entry={id:string;team_id:string;division_id:string;label:string};
export type Game={id:string;home_entry_id:string;away_entry_id:string;rink_id:string;starts_at:string;ends_at:string;status:"draft"|"scheduled"|"cancelled";revision:number};

