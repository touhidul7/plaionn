"use server";
import {revalidatePath} from "next/cache";
import {getVerifiedSession,getLeagueContext} from "@/lib/supabase/session";
import {registrationSchema,decisionSchema,publicationSchema} from "@/lib/registration-schema";
export type RegistrationState={error:boolean;message:string};
const messages:Record<string,string>={REGISTRATION_CLOSED:"Registration is closed for this season.",REGISTRATION_EXISTS:"You already have an application for this season.",REGISTRATION_STALE:"This record changed. Reload before continuing.",REGISTRATION_DATES_REQUIRED:"Set both registration dates in Season settings first."};
function failure(message:string):RegistrationState{return {error:true,message:messages[message]??"Could not save. Check your access and try again."};}
export async function submitRegistration(previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const parsed=registrationSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Select a season and position, and enter your name (2–100 characters)."};
 const {supabase}=await getVerifiedSession();
 const v=parsed.data;
 const {error}=await supabase.rpc("submit_registration",{target_season:v.season_id,player_name:v.display_name,preferred_position:v.position});
 if(error) return failure(error.message);
 revalidatePath("/registration");revalidatePath("/league/registrations");
 return {error:false,message:"Application submitted for league review."};
}
export async function decideRegistration(previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const parsed=decisionSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Select a decision and give a reason (3–500 characters)."};
 const {supabase}=await getVerifiedSession();
 const v=parsed.data;
 if(v.decision!=="withdrawn"){
  const {league,canManage}=await getLeagueContext();
  if(!canManage) return failure("Access denied");
  const {data,error}=await supabase.from("player_registrations").select("id").eq("id",v.registration_id).eq("league_id",league.id).maybeSingle();
  if(error||!data) return failure("Access denied");
 }
 const {error}=await supabase.rpc("decide_registration",{target_registration:v.registration_id,decision:v.decision,expected_revision:v.revision,change_reason:v.reason});
 if(error) return failure(error.message);
 for(const path of ["/registration","/league/registrations","/account","/teams"]) revalidatePath(path);
 return {error:false,message:"Application "+v.decision+"."};
}
export async function publishRegistration(previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const parsed=publicationSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return failure("Invalid form");
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return failure("Access denied");
 const v=parsed.data;
 const {data,error:lookupError}=await supabase.from("seasons").select("id").eq("id",v.season_id).eq("league_id",league.id).maybeSingle();
 if(lookupError||!data) return failure("Access denied");
 const {error}=await supabase.rpc("set_registration_open",{target_season:v.season_id,enabled:v.enabled==="true",expected_revision:v.revision});
 if(error) return failure(error.message);
 revalidatePath("/league/registrations");revalidatePath("/registration");revalidatePath("/league/settings");
 return {error:false,message:v.enabled==="true"?"Registration published for the configured dates.":"Registration closed to new applications."};
}
