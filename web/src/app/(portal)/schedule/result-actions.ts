"use server";
import {revalidatePath} from "next/cache";
import {getLeagueContext} from "@/lib/supabase/session";
import {gameResultReopenSchema,gameResultReviewSchema,gameResultSubmitSchema} from "@/lib/game-result-schema";
import type {ScoreState} from "./score-actions";

function resultError(message:string):string{
 const messages:Record<string,string>={
  RESULT_DECISION_SCORE_MISMATCH:"The selected outcome does not match the recorded score. Check the game log.",
  RESULT_NOT_READY_FOR_SUBMISSION:"This result is already awaiting review or is approved.",
  CORRECTION_REASON_REQUIRED:"Enter why this result is being corrected.",
  REVIEW_REASON_REQUIRED:"Enter a reason for the review decision.",
  RESULT_NOT_PENDING:"Only submitted results can be reviewed.",
  INDEPENDENT_REVIEW_REQUIRED:"A different assigned referee or commissioner must review this result.",
  RESULT_NOT_APPROVED:"Only approved results can be reopened.",
  RESULT_NOT_FOUND:"No result was found for this game.",
  GAME_RESULT_LOCKED:"The result is locked. Reopen it before changing game events.",
 };
 return messages[message]??"The result action failed. Check your game assignment and migration setup.";
}

function refreshResult(gameId:string){
 revalidatePath("/schedule");
 revalidatePath("/schedule/"+gameId+"/scorekeeping");
 revalidatePath("/standings");
}

export async function submitGameResult(_previous:ScoreState,form:FormData):Promise<ScoreState>{
 const parsed=gameResultSubmitSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:parsed.error.issues[0]?.message??"Check the final result details."};
 const {supabase}=await getLeagueContext();
 const {error}=await supabase.rpc("submit_game_result",{
  target_game:parsed.data.game_id,result_decision:parsed.data.decision,change_reason:parsed.data.reason,
 });
 if(error) return {error:true,message:resultError(error.message)};
 refreshResult(parsed.data.game_id);
 return {error:false,message:"Final score submitted for independent review. It is not in the standings yet."};
}

export async function reviewGameResult(_previous:ScoreState,form:FormData):Promise<ScoreState>{
 const parsed=gameResultReviewSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:parsed.error.issues[0]?.message??"Enter a review reason."};
 const {supabase}=await getLeagueContext();
 const {error}=await supabase.rpc("review_game_result",{
  target_game:parsed.data.game_id,approve_result:parsed.data.decision==="approve",review_reason:parsed.data.reason,
 });
 if(error) return {error:true,message:resultError(error.message)};
 refreshResult(parsed.data.game_id);
 return {error:false,message:parsed.data.decision==="approve"?"Result approved and added to official standings.":"Result returned for correction; standings have been updated."};
}

export async function reopenGameResult(_previous:ScoreState,form:FormData):Promise<ScoreState>{
 const parsed=gameResultReopenSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:parsed.error.issues[0]?.message??"Enter a correction reason."};
 const {supabase}=await getLeagueContext();
 const {error}=await supabase.rpc("reopen_game_result",{
  target_game:parsed.data.game_id,change_reason:parsed.data.reason,
 });
 if(error) return {error:true,message:resultError(error.message)};
 refreshResult(parsed.data.game_id);
 return {error:false,message:"Result reopened. It has been removed from official standings until corrected and approved."};
}
