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
  if (item.kind === "season") {
   const seasonRes = await supabase.from("seasons").insert({league_id:league.id,name:item.name}).select("id").single();
   if (seasonRes.error) {
    if(seasonRes.error.code==="23505") return {message:"That name already exists in this league.",error:true};
    return {message:seasonRes.error.message,error:true};
   }
   if (seasonRes.data?.id) {
    const today = new Date().toISOString().split("T")[0];
    const nextYear = new Date(Date.now() + 365*86400000).toISOString().split("T")[0];
    await supabase.from("season_settings").insert({
      season_id: seasonRes.data.id,
      league_id: league.id,
      roster_limit: 20,
      period_count: 3,
      period_minutes: 20,
      clock_mode: "stop",
      win_points: 2,
      tie_points: 1,
      loss_points: 0,
      overtime_loss_points: 1,
      billing_model: "both",
      currency: "CAD",
      team_fee_cents: 100000,
      player_fee_cents: 15000,
      registration_opens: today,
      registration_closes: nextYear,
      registration_enabled: true,
      standings_tiebreakers: ["wins", "goal_difference", "goals_for", "head_to_head", "fewest_penalties"]
    });
   }
   for(const route of ["/","/league","/teams","/registration"]) revalidatePath(route);
   return {message:"Season created with active registration window.",error:false};
  }

  const result = item.kind==="division"
    ?await supabase.from("divisions").insert({league_id:league.id,season_id:item.parentId,name:item.name})
    :await supabase.rpc("create_team_with_entry",{target_league:league.id,target_division:item.parentId,team_name:item.name});
  if(result.error) {
   if(result.error.code==="23505") return {message:"That name already exists in this league, season, or division.",error:true};
   if(result.error.code==="23503") return {message:"Select a parent belonging to this league.",error:true};
   if(result.error.code==="42501") return {message:"You do not have permission to make this change.",error:true};
   return {message:"Supabase could not save this record. Check database setup and try again.",error:true};
  }
  for(const route of ["/","/league","/teams","/registration"]) revalidatePath(route);
  return {message:"Saved to Supabase.",error:false};
 } catch { return {message:"Could not reach Supabase. No local fallback was used. Please try again.",error:true}; }
}

