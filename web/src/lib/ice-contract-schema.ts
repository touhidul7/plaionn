import {z} from "zod";

const hours=z.string().trim().regex(/^\d{1,5}(\.\d{1,2})?$/,"Enter ice hours as a positive number.")
 .transform(Number).pipe(z.number().positive().max(100000))
 .refine(value=>Number.isInteger(value*4),"Purchased ice hours must use quarter-hour increments.");
const money=z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/,"Enter a cost with at most two decimal places.").transform(value=>{
 const [whole,fraction=""]=value.split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}).pipe(z.number().int().min(0).max(100000000));

export const iceContractSchema=z.object({
 title:z.string().trim().min(2).max(100),
 reference:z.string().trim().max(100),
 rink_id:z.uuid(),
 start_date:z.iso.date(),
 end_date:z.iso.date(),
 purchased_hours:hours,
 total_cost:money,
 currency:z.enum(["CAD","USD"]),
}).refine(value=>value.start_date<=value.end_date,{
 message:"Contract end date cannot be before its start date.",path:["end_date"],
}).transform(({total_cost,...contract})=>({...contract,total_cost_cents:total_cost}));

export const iceContractCancellationSchema=z.object({contract_id:z.uuid(),reason:z.string().trim().min(3).max(500)});
export const iceSlotContractSchema=z.object({slot_id:z.uuid(),contract_id:z.union([z.literal(""),z.uuid()]),reason:z.string().trim().min(3).max(500)});
