import Link from "next/link";
import {randomUUID} from "node:crypto";
import {getLeagueData} from "@/lib/league";
import {getLeagueContext} from "@/lib/supabase/session";
import {BlackoutForm,BlackoutRemoveForm,IceSlotForm,IceSlotRemoveForm,PublishScheduleForm,ScheduleGeneratorForm,VenueForm,RinkForm,GameForm} from "@/components/schedule-forms";
import {IceContractsDashboard} from "@/components/ice-contracts-dashboard";
import {ScheduleFairnessDashboard} from "@/components/schedule-fairness-dashboard";
import type {Venue,Rink,Game,Entry} from "@/lib/schedule-schema";
import type {ScheduleBlackout} from "@/lib/ice-slot-schema";
import type {ScheduleAuditInput} from "@/lib/schedule-fairness";
import type {ContractSlot,IceContract} from "@/lib/ice-contracts";
export const dynamic="force-dynamic";
export default async function SchedulePage({searchParams}:{searchParams:Promise<{edit?:string}>}){
 const {edit}=await searchParams;
 const {supabase,league,user,canManage}=await getLeagueContext();
 const base=await getLeagueData();
 const [venues,rinks,games,rawEntries,ownAssignments,iceSlotResult,planResult]=await Promise.all([
  supabase.from("venues").select("id,name,address,time_zone").eq("league_id",league.id).order("name").returns<Venue[]>(),
  supabase.from("rinks").select("id,name,venue_id").eq("league_id",league.id).order("name").returns<Rink[]>(),
  supabase.from("games").select("id,home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status,revision").eq("league_id",league.id).order("starts_at").returns<Game[]>(),
  supabase.from("team_entries").select("id,team_id,division_id").eq("league_id",league.id),
  supabase.from("game_officials").select("game_id").eq("league_id",league.id).eq("user_id",user.id),
  supabase.from("ice_slots").select("id,division_id,rink_id,starts_at,ends_at,local_date,time_tier,is_required").eq("league_id",league.id).order("starts_at"),
  supabase.from("schedule_generation_rules").select("division_id,start_date,end_date,round_robins,max_games_per_week,min_rest_hours,preferred_weekdays").eq("league_id",league.id),
 ]);
 if(venues.error||rinks.error||games.error||rawEntries.error) return <section className="panel empty"><h1>Schedule setup is pending.</h1><p>The scheduling database migration must be applied before fixtures and venues can be managed.</p></section>;
 const scorekeepingIds=new Set(ownAssignments.data?.map(assignment=>assignment.game_id)??[]);
 const entries:Entry[]=rawEntries.data.map(entry=>{
  const team=base.teams.find(t=>t.entry_id===entry.id);
  return {...entry,label:team?team.name+" · "+team.season_name+" / "+team.division_name:"Unavailable team"};
 });
 const scheduleToolsAvailable=!iceSlotResult.error&&!planResult.error;
 const auditedGamesResult=scheduleToolsAvailable?await supabase.from("games")
  .select("id,home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status,ice_slot_id,generated_schedule")
  .eq("league_id",league.id).order("starts_at"):null;
 let contracts:IceContract[]=[];
 let contractSlots:(ContractSlot&{local_date:string;rink_id:string})[]=[];
 let contractDataAvailable=false;
 if(canManage&&scheduleToolsAvailable){
  const [contractResult,contractSlotResult]=await Promise.all([
   supabase.from("ice_contracts").select("id,rink_id,title,reference,start_date,end_date,purchased_hours,total_cost_cents,currency,status,cancellation_reason").eq("league_id",league.id).order("start_date").returns<IceContract[]>(),
   supabase.from("ice_slots").select("id,contract_id,starts_at,ends_at,local_date,rink_id").eq("league_id",league.id).order("starts_at").returns<(ContractSlot&{local_date:string;rink_id:string})[]>(),
  ]);
  if(!contractResult.error&&!contractSlotResult.error&&!auditedGamesResult?.error){
   contracts=contractResult.data??[];
   contractSlots=contractSlotResult.data??[];
   contractDataAvailable=true;
  }
 }
 const blackoutResult=scheduleToolsAvailable&&canManage
  ?await supabase.from("schedule_team_blackouts").select("division_id,team_entry_id,blackout_date").eq("league_id",league.id).order("blackout_date")
  :{data:[],error:null};
 const blackouts:ScheduleBlackout[]=(blackoutResult.data??[]).map(row=>({division_id:row.division_id,team_entry_id:row.team_entry_id,blackout_date:row.blackout_date}));
 const plans=(planResult.data??[]).map(plan=>{
  const division=base.divisions.find(item=>item.id===plan.division_id);
  return division?{division_id:plan.division_id,division_name:division.name,season_name:division.season_name,start_date:plan.start_date,end_date:plan.end_date}:null;
 }).filter((plan):plan is NonNullable<typeof plan>=>plan!==null);
 const auditInput:ScheduleAuditInput={
  entries:entries.map(entry=>({...entry,teamId:entry.team_id,divisionId:entry.division_id})),
  divisions:base.divisions.map(division=>({id:division.id,name:division.name,season_name:division.season_name})),
  venues:venues.data,rinks:rinks.data,
  games:(auditedGamesResult?.data??[]).map(game=>({...game,ice_slot_id:game.ice_slot_id??null})),
  slots:(iceSlotResult.data??[]).map(slot=>({...slot,time_tier:slot.time_tier as "early"|"prime"|"late"})),
  rules:(planResult.data??[]).map(rule=>({...rule,preferred_weekdays:rule.preferred_weekdays??[]})),
  blackouts,canValidateBlackouts:canManage&&!blackoutResult.error,
 };
 const entryLabel=(id:string)=>base.teams.find(t=>t.entry_id===id)?.name??"Unavailable team";
 const editing=games.data.find(game=>game.id===edit);
 const newId=randomUUID();
 const usedSlotIds=new Set((iceSlotResult.data??[]).filter(slot=>games.data.some(game=>game.status!=="cancelled"&&game.rink_id===slot.rink_id&&game.starts_at===slot.starts_at&&game.ends_at===slot.ends_at)).map(slot=>slot.id));
 return <><div className="page-heading"><div><p className="eyebrow">GAME DAY</p><h1>Every game, in its place.</h1><p>{league.name} · Times shown in each venue’s local time zone.</p></div><span className="badge">{games.data.filter(g=>g.status==="scheduled").length} SCHEDULED</span></div>
 <section className="panel"><h2>League schedule</h2>{games.data.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Matchup</th><th scope="col">Start / duration</th><th scope="col">Venue / rink</th><th scope="col">Status</th><th scope="col">Score</th>{(canManage||scorekeepingIds.size>0)&&<th scope="col">Manage</th>}</tr></thead><tbody>{games.data.map(game=>{
  const rink=rinks.data.find(r=>r.id===game.rink_id);
  const venue=venues.data.find(v=>v.id===rink?.venue_id);
  const time=new Intl.DateTimeFormat("en-CA",{timeZone:venue?.time_zone??"UTC",dateStyle:"medium",timeStyle:"short"}).format(new Date(game.starts_at));
  return <tr key={game.id}><td><strong>{entryLabel(game.home_entry_id)}</strong><br/>vs {entryLabel(game.away_entry_id)}</td><td><time dateTime={game.starts_at}>{time}</time><br/><small>{venue?.time_zone} · {(Date.parse(game.ends_at)-Date.parse(game.starts_at))/60000} min</small></td><td>{venue?.name}<br/><small>{rink?.name}</small></td><td><span className="badge">{game.status.toUpperCase()}</span></td><td>{game.status==="scheduled"&&<Link className="button" href={"/schedule/"+game.id+"/live"}>Live score</Link>}</td>{(canManage||scorekeepingIds.size>0)&&<td>{(canManage||scorekeepingIds.has(game.id))&&game.status==="scheduled"&&<Link className="button" href={"/schedule/"+game.id+"/scorekeeping"}>Scorekeeping</Link>} {canManage&&<><Link className="button" href={"/schedule?edit="+game.id+"#game-form"}>Edit game</Link> <Link className="button" href={"/schedule/"+game.id+"/officials"}>Officials</Link></>}</td>}</tr>;
 })}</tbody></table></div>:<div className="empty"><h2>No games scheduled yet.</h2><p>{canManage?"Add a venue and rink, then choose two teams from the same division.":"Your commissioner will publish the schedule here."}</p></div>}</section>
 {canManage&&<>
 <div className="section-heading"><h2>{editing?"Update fixture":"Plan the next game"}</h2>{editing&&<Link href="/schedule" className="text-link">Create a new game instead →</Link>}</div>
 {edit&&!editing&&<p role="status">That game is not available in your selected league.</p>}
 <div id="game-form"><GameForm key={editing?editing.id+":"+editing.revision:newId} id={editing?.id??newId} game={editing} venues={venues.data} rinks={rinks.data} entries={entries}/></div>
 </>}
 <div className="section-heading"><h2>Arenas and rinks</h2><span>{venues.data.length} arenas · {rinks.data.length} rinks</span></div>
 {venues.data.length?<div className="cards">{venues.data.map(venue=><article className="panel" key={venue.id}><h2>{venue.name}</h2><p>{venue.address||"No address added"}<br/>Time zone: {venue.time_zone}</p><strong>Rinks</strong><ul>{rinks.data.filter(rink=>rink.venue_id===venue.id).map(rink=><li key={rink.id}>{rink.name}</li>)}</ul></article>)}</div>:<section className="panel empty"><h2>No arenas added to {league.name} yet.</h2><p>{canManage?"Add an arena and at least one rink below. The arena will then appear here and in the schedule form.":"Ask your league commissioner to add an arena and rink."}</p></section>}
 {canManage&&<><div className="section-heading"><h2>Manage arenas and rinks</h2></div><div className="roster-create"><VenueForm/><RinkForm venues={venues.data}/></div><p className="field-help">A venue is the arena location and time zone; rinks are the playable surfaces within that venue. Use Officials beside a game to assign its referee and timekeeper crew.</p></>}
 <div className="section-heading"><h2>Ice inventory</h2><span>{(iceSlotResult.data??[]).length} slots</span></div>
 {!scheduleToolsAvailable?<section className="panel notice"><p>Ice inventory, blackout rules, and schedule generation need the scheduling inventory migration applied. Existing venue and manual game tools remain available.</p></section>:
  (iceSlotResult.data??[]).length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Date / time</th><th scope="col">Division</th><th scope="col">Arena / rink</th><th scope="col">Tier</th><th scope="col">Required</th><th scope="col">Status</th>{canManage&&<th scope="col">Manage</th>}</tr></thead><tbody>{iceSlotResult.data!.map(slot=>{
   const rink=rinks.data.find(item=>item.id===slot.rink_id),venue=venues.data.find(item=>item.id===rink?.venue_id);
   const division=base.divisions.find(item=>item.id===slot.division_id);
   const time=venue?new Intl.DateTimeFormat("en-CA",{timeZone:venue.time_zone,dateStyle:"medium",timeStyle:"short"}).format(new Date(slot.starts_at)):slot.starts_at;
   return <tr key={slot.id}><td><time dateTime={slot.starts_at}>{time}</time><br/><small>{venue?.time_zone}</small></td><td>{division?.season_name} · {division?.name}</td><td>{venue?.name}<br/><small>{rink?.name}</small></td><td>{slot.time_tier}</td><td>{slot.is_required?"Yes":"Optional"}</td><td>{usedSlotIds.has(slot.id)?"Used":"Available"}</td>{canManage&&<td><IceSlotRemoveForm id={slot.id} used={usedSlotIds.has(slot.id)}/></td>}</tr>;
  })}</tbody></table></div>:<section className="panel empty"><h2>No ice slots recorded.</h2><p>Add actual rink bookings to build an automatic schedule. The sample workbook inventory has not been imported.</p></section>}
 {canManage&&scheduleToolsAvailable&&<><div className="roster-create"><IceSlotForm venues={venues.data} rinks={rinks.data} divisions={base.divisions} contracts={contracts}/><BlackoutForm divisions={base.divisions} entries={entries}/></div>
 {contractDataAvailable?<IceContractsDashboard contracts={contracts} slots={contractSlots} games={(auditedGamesResult?.data??[]).map(game=>({ice_slot_id:game.ice_slot_id??null,status:game.status}))} rinks={rinks.data}/>:<section className="panel notice"><h2>Ice contract tracking is unavailable</h2><p>Apply the ice-contract utilization migration to record purchases, assign slots, and view commissioner-only cost estimates. Existing inventory and scheduling tools remain available.</p></section>}
 <section className="panel"><h2>Team blackout dates</h2>{blackoutResult.error?<p role="status">Could not load blackout dates.</p>:blackouts.length?<ul>{blackouts.map(blackout=>{
  const entry=entries.find(item=>item.id===blackout.team_entry_id);
  const division=base.divisions.find(item=>item.id===blackout.division_id);
  return <li key={blackout.team_entry_id+blackout.blackout_date}>{entry?.label??"Unavailable team"} · {blackout.blackout_date} {division&&`(${division.season_name} · ${division.name})`} <BlackoutRemoveForm blackout={blackout} divisionId={blackout.division_id}/></li>;
 })}</ul>:<p>No team blackout dates recorded.</p>}</section>
 <div className="roster-create"><ScheduleGeneratorForm divisions={base.divisions} entries={entries}/><section className="panel form-stack"><h2>Publish reviewed schedule</h2>{plans.length?plans.map(plan=><PublishScheduleForm key={plan.division_id} plan={plan}/>):<p>Generate a draft schedule first. Its saved date range will appear here for review and publishing.</p>}</section></div>
 </>
 }
 {scheduleToolsAvailable&&!auditedGamesResult?.error
  ?<ScheduleFairnessDashboard input={auditInput}/>
  :<section className="panel notice" aria-label="Schedule analysis unavailable"><p>Schedule analysis needs the inventory migration and readable saved fixture data. Existing fixtures are unchanged.</p></section>}
 </>;
}
