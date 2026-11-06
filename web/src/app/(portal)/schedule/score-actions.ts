"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {gameEventSchema,voidGameEventSchema} from "@/lib/game-event-schema";
import {getLeagueContext} from "@/lib/supabase/session";

export type ScoreState={error:boolean;message:string};

export async function addGameEvent(_previous:ScoreState,form:FormData):Promise<ScoreState>{
 const parsed=gameEventSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:parsed.error.issues[0]?.message??"Check the game event details."};
 const {supabase}=await getLeagueContext();
 const value=parsed.data;
 const {error}=await supabase.rpc("add_game_event",{
  target_game:value.game_id,client_event:value.client_event_id,event_type:value.event_kind,
  target_entry:value.team_entry_id,target_period:value.period,clock_remaining:value.clock_remaining,
  target_player:value.player_id,assist_one:value.assist_one_id,assist_two:value.assist_two_id,
  penalty_duration:value.penalty_minutes,
 });
 if(error){
  const messages:Record<string,string>={
   INVALID_GAME_EVENT:"That period or clock time is outside this season’s game format.",
   INVALID_GAME_TEAM:"Select one of the teams playing this game.",
   PLAYER_NOT_ACTIVE_ON_TEAM:"The selected player is not active on that team’s roster.",
   INVALID_ASSIST:"Assists must be different active players on the scoring team.",
   INVALID_PENALTY:"Select a valid penalty duration and leave assists blank.",
   EVENT_IDEMPOTENCY_CONFLICT:"This event retry does not match the previously saved event.",
   SEASON_SETTINGS_REQUIRED:"Save season settings before scoring this game.",
  };
  return {error:true,message:messages[error.message]??"The event could not be saved. Check the game assignment and retry."};
 }
 const path="/schedule/"+value.game_id+"/scorekeeping";
 revalidatePath(path);
 redirect(path+"?saved=1");
}

export async function voidGameEvent(_previous:ScoreState,form:FormData):Promise<ScoreState>{
 const parsed=voidGameEventSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Enter a reason of 3–500 characters."};
 const {supabase}=await getLeagueContext();
 const {error}=await supabase.rpc("void_game_event",{target_event:parsed.data.event_id,change_reason:parsed.data.reason});
 if(error){
  const messages:Record<string,string>={VOID_REASON_REQUIRED:"Enter a reason for correcting this event.",GAME_NOT_EDITABLE:"This game is no longer open for corrections."};
  return {error:true,message:messages[error.message]??"Only an assigned referee or league commissioner can void an event."};
 }
 revalidatePath("/schedule");
 revalidatePath("/schedule/"+parsed.data.game_id+"/scorekeeping");
 return {error:false,message:"Event voided. Its original record remains in the audit history."};
}
