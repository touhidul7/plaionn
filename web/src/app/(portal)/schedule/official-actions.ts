"use server";
import {revalidatePath} from "next/cache";
import {getLeagueContext} from "@/lib/supabase/session";
import {officialSchema} from "@/lib/official-schema";
export type OfficialState={error:boolean;message:string};
export async function saveOfficial(previous:OfficialState,form:FormData):Promise<OfficialState>{
 const parsed=officialSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Select an official slot and enter a reason (3–500 characters)."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {error:true,message:"Commissioner access is required."};
 const v=parsed.data;
 const {error}=await supabase.rpc("save_game_official",{target_game:v.game_id,target_league:league.id,target_slot:v.slot,target_user:v.user_id||null,expected_revision:v.revision,change_reason:v.reason});
 if(error){
  const messages:Record<string,string>={OFFICIAL_CONFLICT:"This official already has a game during that time.",OFFICIAL_DUPLICATE:"This person already has another role in this game.",OFFICIAL_ROLE_REQUIRED:"Choose a league member with the matching official role.",GAME_STALE:"The game or assignments changed. Reload before saving.",GAME_CANCELLED:"Restore the game before assigning an official."};
  return {error:true,message:messages[error.message]??"The assignment could not be saved."};
 }
 revalidatePath("/schedule");
 revalidatePath("/schedule/"+v.game_id+"/officials");
 return {error:false,message:v.user_id?"Official assigned.":"Assignment removed; history retained."};
}
