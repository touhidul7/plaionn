"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
export type FormState={message:string;error:boolean};
const schema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("season"),name:z.string().trim().min(2).max(100)}),
 z.object({kind:z.literal("division"),name:z.string().trim().min(2).max(100),parentId:z.uuid()}),
 z.object({kind:z.literal("team"),name:z.string().trim().min(2).max(100),parentId:z.uuid()}),
]);
export async function createRecord(_previous:FormState,formData:FormData):Promise<FormState> {
 const parsed=schema.safeParse(Object.fromEntries(formData));
 if(!parsed.success) return {message:"Enter a name of 2–100 characters and select a valid parent where required.",error:true};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {message:"Only this league's commissioners can create records.",error:true};
 const item=parsed.data;
 try {
  const result=item.kind==="season"
   ?await supabase.from("seasons").insert({league_id:league.id,name:item.name})
   :item.kind==="division"
    ?await supabase.from("divisions").insert({league_id:league.id,season_id:item.parentId,name:item.name})
    :await supabase.rpc("create_team_with_entry",{target_league:league.id,target_division:item.parentId,team_name:item.name});
  if(result.error) {
   if(result.error.code==="23505") return {message:"That name already exists in this league, season, or division.",error:true};
   if(result.error.code==="23503") return {message:"Select a parent belonging to this league.",error:true};
   if(result.error.code==="42501") return {message:"You do not have permission to make this change.",error:true};
   return {message:"Supabase could not save this record. Check database setup and try again.",error:true};
  }
  for(const route of ["/","/league","/teams"]) revalidatePath(route);
  return {message:"Saved to Supabase.",error:false};
 } catch { return {message:"Could not reach Supabase. No local fallback was used. Please try again.",error:true}; }
}

