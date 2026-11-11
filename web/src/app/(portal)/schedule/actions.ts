"use server";
import {revalidatePath} from "next/cache";
import {getLeagueContext} from "@/lib/supabase/session";
import {gameSchema,venueSchema,rinkSchema,startInUtc,iceSlotTimes} from "@/lib/schedule-schema";
import {blackoutSchema,iceSlotSchema,scheduleGenerationSchema,schedulePublishSchema} from "@/lib/ice-slot-schema";
import {iceContractCancellationSchema,iceContractSchema,iceSlotContractSchema} from "@/lib/ice-contract-schema";
import {generateSchedule as generateSchedulePlan,ScheduleGenerationError,type ExistingBooking,type IceSlot,type ScheduleTeam} from "@/lib/schedule-generator";
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
  const messages:Record<string,string>={OFFICIAL_CONFLICT:"An assigned official has another game during that time. Update the crew or choose a different time.",SCORED_MATCHUP_LOCKED:"This game already has recorded events. Create a new game to change the teams.",GAME_RESULT_EXISTS:"A submitted result is attached to this game. Create a new fixture instead of changing or cancelling it.",RINK_CONFLICT:"This rink is already booked during that time.",TEAM_CONFLICT:"One of these teams already has a game during that time.",GAME_STALE:"This game changed in another session. Reload before saving.",INVALID_MATCHUP:"Select different teams from the same division.",CHANGE_REASON_REQUIRED:"Enter a reason for the schedule change."};
  return {...previous,error:true,message:messages[error.message]??"The game could not be saved. Check database setup and permissions."};
 }
 revalidatePath("/schedule");
 return {error:false,message:v.status==="cancelled"?"Game cancelled; its booking is released.":v.status==="draft"?"Draft saved. Only commissioners can see it.":"Game saved to the league schedule.",revision:Number(data)};
}

export async function createIceSlot(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=iceSlotSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Check the ice-slot details."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const rink=await supabase.from("rinks").select("id,venue_id").eq("id",parsed.data.rink_id).eq("league_id",league.id).maybeSingle();
 if(rink.error||!rink.data) return {...previous,error:true,message:"Select a rink in this league."};
 const venue=await supabase.from("venues").select("time_zone").eq("id",rink.data.venue_id).eq("league_id",league.id).maybeSingle();
 if(venue.error||!venue.data) return {...previous,error:true,message:"Could not load the rink's time zone."};
 let times:{startsAt:string;endsAt:string;localDate:string};
 try{times=iceSlotTimes(parsed.data.local_start,parsed.data.local_end,venue.data.time_zone);}
 catch(error){return {...previous,error:true,message:error instanceof Error?error.message:"This ice-slot time is invalid or ambiguous. Choose another time."};}
 const {error}=parsed.data.contract_id
  ?await supabase.rpc("create_ice_slot_with_contract",{
   target_league:league.id,target_division:parsed.data.division_id,target_rink:parsed.data.rink_id,
   start_time:times.startsAt,end_time:times.endsAt,slot_tier:parsed.data.time_tier,
   slot_required:parsed.data.required,target_contract:parsed.data.contract_id,
  })
  :await supabase.rpc("create_ice_slot",{
   target_league:league.id,target_division:parsed.data.division_id,target_rink:parsed.data.rink_id,
   start_time:times.startsAt,end_time:times.endsAt,slot_tier:parsed.data.time_tier,slot_required:parsed.data.required,
  });
 if(error){
  const messages:Record<string,string>={ICE_SLOT_CONFLICT:"This rink already has an overlapping ice slot.",GAME_CONFLICT:"A game already uses this rink and time.",ICE_CONTRACT_UNAVAILABLE:"Select an active ice contract.",ICE_CONTRACT_SLOT_MISMATCH:"The ice contract must cover this rink and slot date."};
  return {...previous,error:true,message:messages[error.message]??"Ice slot could not be saved. Check database setup and permissions."};
 }
 revalidatePath("/schedule");
 return {...previous,error:false,message:`Ice slot added for ${times.localDate}.`};
}

export async function createIceContract(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=iceContractSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Check the ice contract details."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required to manage ice costs."};
 const rink=await supabase.from("rinks").select("id").eq("id",parsed.data.rink_id).eq("league_id",league.id).maybeSingle();
 if(rink.error||!rink.data) return {...previous,error:true,message:"Select a rink in this league."};
 const value=parsed.data;
 const {error}=await supabase.rpc("create_ice_contract",{
  target_league:league.id,target_rink:value.rink_id,contract_title:value.title,contract_reference:value.reference,
  contract_start:value.start_date,contract_end:value.end_date,contract_hours:value.purchased_hours,
  contract_cost_cents:value.total_cost_cents,contract_currency:value.currency,
 });
 if(error){
  const messages:Record<string,string>={INVALID_ICE_CONTRACT:"Check the dates, contracted hours, currency, and cost."};
  return {...previous,error:true,message:messages[error.message]??"Ice contract could not be saved. Check that the migration is applied."};
 }
 revalidatePath("/schedule");
 return {...previous,error:false,message:"Ice contract saved. Assign its purchased hours to matching inventory slots."};
}

export async function assignIceSlotContract(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=iceSlotContractSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Check the slot contract assignment."};
 const {supabase,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required to manage ice costs."};
 const {error}=await supabase.rpc("assign_ice_slot_contract",{
  target_slot:parsed.data.slot_id,target_contract:parsed.data.contract_id||null,change_reason:parsed.data.reason,
 });
 if(error){
  const messages:Record<string,string>={ICE_CONTRACT_UNAVAILABLE:"Choose an active contract.",ICE_CONTRACT_SLOT_MISMATCH:"Contract rink and dates must match the ice slot.",CHANGE_REASON_REQUIRED:"Enter why this assignment changed."};
  return {...previous,error:true,message:messages[error.message]??"Ice contract assignment failed. Check the migration and permissions."};
 }
 revalidatePath("/schedule");
 return {...previous,error:false,message:"Ice slot contract assignment saved and audited."};
}

export async function cancelIceContract(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=iceContractCancellationSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:"Enter a reason of 3–500 characters."};
 const {supabase,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required to cancel ice contracts."};
 const {error}=await supabase.rpc("cancel_ice_contract",{
  target_contract:parsed.data.contract_id,change_reason:parsed.data.reason,
 });
 if(error){
  const messages:Record<string,string>={ICE_CONTRACT_HAS_ASSIGNED_SLOTS:"Unassign all inventory slots before cancelling this contract.",ICE_CONTRACT_ALREADY_CANCELLED:"This contract is already cancelled.",CANCELLATION_REASON_REQUIRED:"Enter a cancellation reason."};
  return {...previous,error:true,message:messages[error.message]??"Ice contract could not be cancelled. Check the migration and permissions."};
 }
 revalidatePath("/schedule");
 return {...previous,error:false,message:"Contract cancelled and retained in the audit history."};
}

export async function removeIceSlot(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const slotId=form.get("slot_id");
 if(typeof slotId!=="string"||!/^[0-9a-f-]{36}$/i.test(slotId)) return {...previous,error:true,message:"Select a valid ice slot."};
 const {supabase,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const {error}=await supabase.rpc("remove_ice_slot",{target_slot:slotId});
 if(error) return {...previous,error:true,message:error.message==="ICE_SLOT_IN_USE"?"This slot is used by a scheduled game and cannot be removed.":"Ice slot could not be removed."};
 revalidatePath("/schedule");
 return {...previous,error:false,message:"Ice slot removed."};
}

export async function saveBlackout(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=blackoutSchema.safeParse(Object.fromEntries(form));
 const remove=form.get("remove")==="true";
 if(!parsed.success) return {...previous,error:true,message:"Select a team and a valid blackout date."};
 const divisionId=form.get("division_id");
 if(typeof divisionId!=="string"||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(divisionId)) return {...previous,error:true,message:"Select a valid division."};
 const {supabase,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const {error}=await supabase.rpc("save_schedule_blackout",{
  target_division:divisionId,target_entry:parsed.data.entry_id,blackout_day:parsed.data.blackout_date,remove_entry:remove,
 });
 if(error) return {...previous,error:true,message:error.code==="23505"?"That blackout date is already recorded.":"Team blackout could not be saved."};
 revalidatePath("/schedule");
 return {...previous,error:false,message:remove?"Team blackout removed.":"Team blackout added."};
}

export async function generateSchedule(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 const parsed=scheduleGenerationSchema.safeParse({...Object.fromEntries(form),preferred_weekdays:form.getAll("preferred_weekdays")});
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Check the schedule rules."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const rules=parsed.data;
 const [division,entryResult,allEntryResult,slotResult,blackoutResult,venueResult,gameResult]=await Promise.all([
  supabase.from("divisions").select("id").eq("id",rules.division_id).eq("league_id",league.id).maybeSingle(),
  supabase.from("team_entries").select("id,team_id").eq("division_id",rules.division_id).eq("league_id",league.id),
  supabase.from("team_entries").select("id,team_id").eq("league_id",league.id),
  supabase.from("ice_slots").select("id,division_id,rink_id,starts_at,ends_at,time_tier,is_required,local_date").eq("league_id",league.id).eq("division_id",rules.division_id),
  supabase.from("schedule_team_blackouts").select("team_entry_id,blackout_date").eq("division_id",rules.division_id).eq("league_id",league.id),
  supabase.from("venues").select("id,time_zone").eq("league_id",league.id),
  supabase.from("games").select("home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status").eq("league_id",league.id).neq("status","cancelled"),
 ]);
 if(division.error||!division.data) return {...previous,error:true,message:"The selected division is not available in this league."};
 if(entryResult.error||allEntryResult.error||slotResult.error||blackoutResult.error||venueResult.error||gameResult.error)
  return {...previous,error:true,message:"Could not load the teams, ice inventory, or existing schedule. Check database setup."};
 const teams:ScheduleTeam[]=entryResult.data.map(entry=>({entryId:entry.id,teamId:entry.team_id}));
 const entryTeam=new Map(allEntryResult.data.map(entry=>[entry.id,entry.team_id]));
 const venueZones=new Map(venueResult.data.map(venue=>[venue.id,venue.time_zone]));
 const rinkVenues=await supabase.from("rinks").select("id,venue_id").eq("league_id",league.id);
 if(rinkVenues.error) return {...previous,error:true,message:"Could not load rink locations."};
 const rinkVenue=new Map(rinkVenues.data.map(rink=>[rink.id,rink.venue_id]));
 const slots:IceSlot[]=[];
 for(const slot of slotResult.data){
  const venueId=rinkVenue.get(slot.rink_id);
  const timeZone=venueId?venueZones.get(venueId):undefined;
  if(!venueId||!timeZone) return {...previous,error:true,message:"An ice slot references a rink or venue that is not available in this league."};
  slots.push({id:slot.id,rinkId:slot.rink_id,venueId,startsAt:slot.starts_at,endsAt:slot.ends_at,timeZone,tier:slot.time_tier,required:slot.is_required});
 }
 const existingBookings:ExistingBooking[]=[];
 for(const game of gameResult.data){
  const homeTeamId=entryTeam.get(game.home_entry_id),awayTeamId=entryTeam.get(game.away_entry_id);
  const venueId=rinkVenue.get(game.rink_id),timeZone=venueId?venueZones.get(venueId):undefined;
  if(!homeTeamId||!awayTeamId||!timeZone) return {...previous,error:true,message:"An existing game references a team, rink, or venue that is not available in this league."};
  existingBookings.push({homeTeamId,awayTeamId,rinkId:game.rink_id,startsAt:game.starts_at,endsAt:game.ends_at,timeZone});
 }
 let generated:ReturnType<typeof generateSchedulePlan>;
 try{
  generated=generateSchedulePlan({
   teams,slots,blackouts:blackoutResult.data.map(row=>({entryId:row.team_entry_id,date:row.blackout_date})),
   existingBookings,startDate:rules.start_date,endDate:rules.end_date,roundRobins:rules.round_robins,
   maxGamesPerWeek:rules.max_games_per_week,minRestHours:rules.min_rest_hours,preferredWeekdays:rules.preferred_weekdays,
  });
 }catch(error){
  if(error instanceof ScheduleGenerationError) return {...previous,error:true,message:error.message};
  throw error;
 }
 const fixtures=generated.fixtures.map(fixture=>({
  game_id:crypto.randomUUID(),slot_id:fixture.slot.id,home_entry_id:fixture.homeEntryId,away_entry_id:fixture.awayEntryId,
 }));
 const {data,error}=await supabase.rpc("generate_schedule_drafts",{
  target_division:rules.division_id,start_date:rules.start_date,end_date:rules.end_date,
  round_robin_count:rules.round_robins,max_per_week:rules.max_games_per_week,min_rest:rules.min_rest_hours,
  preferred_weekdays:rules.preferred_weekdays,replace_existing_drafts:rules.replace_existing_drafts,fixture_data:fixtures,
 });
 if(error){
  const messages:Record<string,string>={TEAM_BLACKOUT:"A generated game conflicts with a team blackout.",REQUIRED_SLOT_UNUSED:"The schedule did not use every required ice slot.",MAX_GAMES_PER_WEEK:"The generated schedule exceeds a team's weekly game limit.",MINIMUM_REST:"The generated schedule violates the minimum-rest rule.",EXISTING_GAME_CONFLICT:"An existing game conflicts with a generated slot.",ICE_SLOT_ALREADY_USED:"At least one selected ice slot already has a game. Review the current schedule.",REPLACEMENT_CONFIRMATION_REQUIRED:"Generated drafts already exist. Choose the replacement option only if you want to cancel and replace those drafts.",PUBLISHED_SCHEDULE_EXISTS:"Published generated games cannot be replaced. Cancel them through the audited game editor first.",SCHEDULE_ALREADY_EXISTS:"This division already has manual games in that date range. Cancel those fixtures before generating a replacement schedule.",SCHEDULE_TOO_LARGE:"This schedule has more than 256 games. Generate smaller divisions or schedules.",NOT_ENOUGH_TEAMS:"Add at least two teams to the selected division.",INVALID_FIXTURE_COUNT:"Generated game count did not match the round-robin format."};
  return {...previous,error:true,message:messages[error.message]??"Schedule drafts could not be saved. Check the rules and database setup."};
 }
 revalidatePath("/schedule");
 return {...previous,error:false,message:`Created ${data} draft games. Review them below before publishing. Hard checks passed: round-robin pairings, required slots, blackouts, weekly limits, minimum rest, and existing-booking conflicts. Fairness heuristic: home/away spread ${generated.fairness.homeAwaySpread}, time-tier spread ${generated.fairness.timeTierSpread}, arena spread ${generated.fairness.arenaSpread}.`,revision:0};
}

export async function publishSchedule(previous:ScheduleState,form:FormData):Promise<ScheduleState>{
 if(form.get("confirm")!=="yes") return {...previous,error:true,message:"Confirm that you reviewed the draft schedule before publishing."};
 const parsed=schedulePublishSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {...previous,error:true,message:parsed.error.issues[0]?.message??"Choose a division and valid season date range."};
 const {supabase,canManage}=await getLeagueContext();
 if(!canManage) return {...previous,error:true,message:"Commissioner access is required."};
 const {data,error}=await supabase.rpc("publish_schedule_drafts",{target_division:parsed.data.division_id,start_date:parsed.data.start_date,end_date:parsed.data.end_date});
 if(error) return {...previous,error:true,message:error.message==="NO_GENERATED_DRAFTS"?"There are no generated draft games in that date range.":"The schedule could not be published."};
 revalidatePath("/schedule");
 return {...previous,error:false,message:`Published ${data} games to the league schedule.`};
}
