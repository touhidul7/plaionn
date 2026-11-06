"use server";
import {revalidatePath} from "next/cache";
import {getLeagueContext} from "@/lib/supabase/session";
import {playerSchema,rosterSchema} from "@/lib/roster-schema";
export type RosterState={error:boolean;message:string;revision:number};
export async function createPlayer(previous:RosterState,form:FormData):Promise<RosterState>{
 const parsed=playerSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:"Enter a player name between 2 and 100 characters."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 try{
  const {error}=await supabase.rpc("create_league_player",{target_league:league.id,player_name:parsed.data.display_name});
  if(error) return {...previous,error:true,message:"Player could not be added. Check permissions and database setup."};
  revalidatePath("/teams","layout");
  return {...previous,error:false,message:"Player profile created. Select them below to add them to the roster."};
 }catch{return {...previous,error:true,message:"Unable to reach the database. Please try again."};}
}
export async function saveRoster(previous:RosterState,form:FormData):Promise<RosterState>{
 const parsed=rosterSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:"Select a player, position, and status. Jersey numbers must be blank or 0–99."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const value=parsed.data;
 try{
  const entry=await supabase.from("team_entries").select("id").eq("id",value.team_entry_id).eq("league_id",league.id).maybeSingle();
  if(entry.error||!entry.data) return {...previous,error:true,message:"This team is not available in your selected league."};
  const {data,error}=await supabase.rpc("save_roster_member",{
   target_entry:value.team_entry_id,target_player:value.player_id,jersey:value.jersey_number,
   player_position:value.position,member_status:value.status,expected_revision:value.revision,
  });
  if(error){
   const messages:Record<string,string>={
    ROSTER_FULL:"The active roster is full. Make a player inactive or update the season limit.",
    ROSTER_NOT_CONFIGURED:"Configure this season's roster limit in League HQ first.",
    ROSTER_STALE:"This roster entry changed. Reload the page before saving again.",
   };
   return {...previous,error:true,message:messages[error.message]??(error.code==="23505"?"That jersey number is already used by an active player.":"The roster change could not be saved.")};
  }
  revalidatePath("/teams","layout");
  return {error:false,message:"Roster saved. Roster status does not replace waiver, payment, or game-eligibility checks.",revision:Number(data)};
 }catch{return {...previous,error:true,message:"Unable to save this change. Please try again."};}
}

