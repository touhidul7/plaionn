"use server";
import {revalidatePath} from "next/cache";
import {getLeagueContext} from "@/lib/supabase/session";
import {gameSchema,venueSchema,rinkSchema,startInUtc} from "@/lib/schedule-schema";
export type ScheduleState={error:boolean;message:string;revision:number};
export async function createVenue(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=venueSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:"Check venue name, rink name, address, and time zone."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const v=parsed.data;
 const {error}=await supabase.rpc("create_venue",{target_league:league.id,venue_name:v.name,venue_address:v.address,zone:v.time_zone,first_rink:v.rink_name});
 if(error) return {...previous,error:true,message:error.code==="23505"?"This venue name already exists. Add a rink to the existing venue.":"Venue could not be saved. Check database setup and permissions."};
 revalidatePath("/schedule");
 return {...previous,error:false,message:"Venue and first rink created."};
}
export async function createRink(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=rinkSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:"Select a venue and enter a rink name."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const venue=await supabase.from("venues").select("id").eq("id",parsed.data.venue_id).eq("league_id",league.id).maybeSingle();
 if(venue.error||!venue.data) return {...previous,error:true,message:"Venue is not available in this league."};
 const {error}=await supabase.rpc("create_rink",{target_venue:parsed.data.venue_id,rink_name:parsed.data.name});
 if(error) return {...previous,error:true,message:error.code==="23505"?"That rink name already exists at this venue.":"Rink could not be saved."};
 revalidatePath("/schedule");
 return {...previous,error:false,message:"Rink created."};
}
export async function saveGame(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=gameSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Check the game details."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const v=parsed.data;
 const rink=await supabase.from("rinks").select("venue_id").eq("id",v.rink_id).eq("league_id",league.id).maybeSingle();
 if(rink.error||!rink.data) return {...previous,error:true,message:"Select a rink in this league."};
 const venue=await supabase.from("venues").select("time_zone").eq("id",rink.data.venue_id).eq("league_id",league.id).single();
 if(venue.error) return {...previous,error:true,message:"Could not load the rink's time zone."};
 let start:string;
 try{start=startInUtc(v.local_start,venue.data.time_zone);}catch{return {...previous,error:true,message:"This date/time is invalid or ambiguous because of daylight saving. Choose a different start time."};}
 const {data,error}=await supabase.rpc("save_scheduled_game",{
  target_game:v.id,target_league:league.id,home_entry:v.home_entry_id,away_entry:v.away_entry_id,
  target_rink:v.rink_id,start_time:start,duration_minutes:v.duration,game_status:v.status,expected_revision:v.revision,change_reason:v.reason,
 });
 if(error){
  const messages:Record<string,string>={OFFICIAL_CONFLICT:"An assigned official has another game during that time. Update the crew or choose a different time.",SCORED_MATCHUP_LOCKED:"This game already has recorded events. Create a new game to change the teams.",RINK_CONFLICT:"This rink is already booked during that time.",TEAM_CONFLICT:"One of these teams already has a game during that time.",GAME_STALE:"This game changed in another session. Reload before saving.",INVALID_MATCHUP:"Select different teams from the same division.",CHANGE_REASON_REQUIRED:"Enter a reason for the schedule change."};
  return {...previous,error:true,message:messages[error.message]??"The game could not be saved. Check database setup and permissions."};
 }
 revalidatePath("/schedule");
 return {error:false,message:v.status==="cancelled"?"Game cancelled; its booking is released.":v.status==="draft"?"Draft saved. Only commissioners can see it.":"Game saved to the league schedule.",revision:Number(data)};
}

