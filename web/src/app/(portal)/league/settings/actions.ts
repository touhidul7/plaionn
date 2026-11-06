"use server";
import {revalidatePath} from "next/cache";
import {settingsSchema} from "@/lib/season-settings-schema";
import {getLeagueContext} from "@/lib/supabase/session";
export type SettingsState={error:boolean;message:string;revision:number};
export async function saveSettings(previous:SettingsState,form:FormData):Promise<SettingsState>{
 const parsed=settingsSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Check the settings."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Only a league commissioner can change these settings."};
 const {season_id,revision,...values}=parsed.data;
 try{
  const result=revision===0
   ?await supabase.from("season_settings").insert({...values,season_id,league_id:league.id}).select("revision").single()
   :await supabase.from("season_settings").update(values).eq("season_id",season_id).eq("league_id",league.id).eq("revision",revision).select("revision").maybeSingle();
  if(result.error?.code==="23505"||(!result.error&&!result.data)) return {...previous,error:true,message:"These settings changed in another session. Reload this page before saving again."};
  if(result.error?.message==="ROSTER_LIMIT_BELOW_CURRENT") return {...previous,error:true,message:"The limit cannot be lower than an existing active team roster. Deactivate players first."};
  if(result.error) return {...previous,error:true,message:"Settings could not be saved. Check your permissions and database setup."};
  revalidatePath("/league/settings");
  revalidatePath("/league/registrations");
  revalidatePath("/registration");
  return {error:false,message:"Season settings saved.",revision:result.data!.revision};
 }catch{return {...previous,error:true,message:"Unable to save right now. Your changes have not been confirmed."};}
}

