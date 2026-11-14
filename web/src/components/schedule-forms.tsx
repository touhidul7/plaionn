"use client";
import {useActionState,useState} from "react";
import {assignIceSlotContract,cancelIceContract,createIceContract,createIceSlot,createVenue,createRink,generateSchedule,publishSchedule,removeIceSlot,saveBlackout,saveGame} from "@/app/(portal)/schedule/actions";
import {localGameTime,type Venue,type Rink,type Entry,type Game} from "@/lib/schedule-schema";
import type {ScheduleBlackout} from "@/lib/ice-slot-schema";
const initial={error:false,message:"",revision:0};
const scheduleInitial={error:false,message:"",revision:0};
export function VenueForm(){
 const [state,action,pending]=useActionState(createVenue,initial);
 return <form action={action} className="panel form-stack"><h2>Add a venue</h2><label>Venue name<input name="name" required minLength={2} maxLength={100}/></label><label>Address<input name="address" maxLength={300}/></label><label>Time zone<input name="time_zone" defaultValue="America/Toronto" required list="venue-zones"/></label><datalist id="venue-zones">{["America/Toronto","America/Vancouver","America/Edmonton","America/Winnipeg","America/Halifax","Asia/Dhaka","UTC"].map(zone=><option key={zone} value={zone}/>)}</datalist><label>First rink name<input name="rink_name" required maxLength={100} placeholder="Rink 1"/></label><button className="button primary" disabled={pending}>{pending?"Saving…":"Create venue and rink"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function RinkForm({venues}:{venues:Venue[]}){
 const [state,action,pending]=useActionState(createRink,initial);
 return <form action={action} className="panel form-stack"><h2>Add another rink</h2><label>Venue<select name="venue_id" required defaultValue=""><option value="" disabled>Select venue</option>{venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>Rink name<input name="name" required maxLength={100}/></label><button className="button primary" disabled={pending||!venues.length}>{pending?"Saving…":"Create rink"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function GameForm({id,venues,rinks,entries,game}:{id:string;venues:Venue[];rinks:Rink[];entries:Entry[];game?:Game}){
 const [state,action,pending]=useActionState(saveGame,{...initial,revision:game?.revision??0});
 const [rinkId,setRinkId]=useState(game?.rink_id??"");
 const [home,setHome]=useState(game?.home_entry_id??"");
 const venue=venues.find(v=>v.id===rinks.find(r=>r.id===rinkId)?.venue_id);
 const homeEntry=entries.find(e=>e.id===home);
 const awayEntries=entries.filter(e=>e.id!==home&&e.team_id!==homeEntry?.team_id&&e.division_id===homeEntry?.division_id);
 const existingZone=venues.find(v=>v.id===rinks.find(r=>r.id===game?.rink_id)?.venue_id)?.time_zone;
 const local=game&&existingZone?localGameTime(game.starts_at,existingZone):"";
 return <form action={action} className="panel form-stack"><h2>{game?"Edit game":"Schedule a game"}</h2>
 <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={state.revision}/>
 <div className="settings-grid"><label>Home team<select name="home_entry_id" required value={home} onChange={e=>setHome(e.target.value)}><option value="" disabled>Select team</option>{entries.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 <label>Away team<select key={home} name="away_entry_id" required defaultValue={awayEntries.some(e=>e.id===game?.away_entry_id)?game?.away_entry_id:""}><option value="" disabled>Select opponent</option>{awayEntries.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 <label>Venue / rink<select name="rink_id" required value={rinkId} onChange={e=>setRinkId(e.target.value)}><option value="" disabled>Select rink</option>{rinks.map(r=><option key={r.id} value={r.id}>{venues.find(v=>v.id===r.venue_id)?.name} · {r.name}</option>)}</select></label>
 <label>Start time ({venue?.time_zone??"select a rink"})<input name="local_start" type="datetime-local" required defaultValue={local}/></label>
 <label>Booking duration (minutes)<input type="number" name="duration" min={15} max={360} step={1} required defaultValue={game?(Date.parse(game.ends_at)-Date.parse(game.starts_at))/60000:60}/></label>
 <label>Status<select name="status" defaultValue={game?.status??"draft"}><option value="draft">Draft — commissioners only</option><option value="scheduled">Scheduled — league members</option>{game&&<option value="cancelled">Cancelled</option>}</select></label></div>
 <p className="field-help">Times use the selected venue’s time zone. Drafts reserve the rink and teams. Back-to-back bookings are allowed.</p>
 {game?<label>Reason for change<input name="reason" required minLength={3} maxLength={500}/></label>:<input type="hidden" name="reason" value=""/>}
 <button className="primary" disabled={pending||!rinks.length||entries.length<2}>{pending?"Saving…":"Save game"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}
export function IceSlotForm({venues,rinks,divisions,contracts}:{venues:Venue[];rinks:Rink[];divisions:{id:string;name:string;season_name:string}[];contracts:{id:string;title:string;rink_id:string;start_date:string;end_date:string;status:"active"|"cancelled"}[]}){
 const [state,action,pending]=useActionState(createIceSlot,scheduleInitial);
 const [rinkId,setRinkId]=useState("");
 return <form action={action} className="panel form-stack"><h2>Add an ice slot</h2><label>Division<select name="division_id" required defaultValue=""><option value="" disabled>Select division</option>{divisions.map(division=><option key={division.id} value={division.id}>{division.season_name} · {division.name}</option>)}</select></label>
 <label>Rink<select name="rink_id" required value={rinkId} onChange={event=>setRinkId(event.target.value)}><option value="" disabled>Select rink</option>{rinks.map(rink=><option key={rink.id} value={rink.id}>{venues.find(venue=>venue.id===rink.venue_id)?.name} · {rink.name}</option>)}</select></label>
 <label>Purchased ice contract (optional)<select name="contract_id" defaultValue=""><option value="">Not linked to a contract</option>{contracts.filter(contract=>contract.status==="active"&&contract.rink_id===rinkId).map(contract=><option key={contract.id} value={contract.id}>{contract.title} · {contract.start_date}–{contract.end_date}</option>)}</select></label>
 <div className="settings-grid"><label>Start (rink&apos;s local time)<input type="datetime-local" name="local_start" required/></label><label>End (same local date)<input type="datetime-local" name="local_end" required/></label>
 <label>Time tier<select name="time_tier" defaultValue="prime"><option value="early">Early</option><option value="prime">Prime</option><option value="late">Late</option></select></label>
 <label>Slot requirement<select name="required" defaultValue="true"><option value="true">Required — must be used</option><option value="false">Optional — use if needed</option></select></label></div>
 <p className="field-help">Slots are saved in the selected arena&apos;s time zone. Each slot must be 15 minutes to 6 hours and cannot overlap another booking on that rink.</p>
 <button className="primary" disabled={pending||!rinks.length||!divisions.length}>{pending?"Saving…":"Add ice slot"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function IceContractForm({rinks}:{rinks:Rink[]}){
 const [state,action,pending]=useActionState(createIceContract,scheduleInitial);
 return <form action={action} className="panel form-stack"><h2>Record purchased ice contract</h2>
  <label>Contract name<input name="title" required minLength={2} maxLength={100} placeholder="Winter ice package"/></label>
  <label>Vendor reference (optional)<input name="reference" maxLength={100}/></label>
  <label>Rink<select name="rink_id" required defaultValue=""><option value="" disabled>Select rink</option>{rinks.map(rink=><option key={rink.id} value={rink.id}>{rink.name}</option>)}</select></label>
  <div className="settings-grid"><label>Contract start<input type="date" name="start_date" required/></label><label>Contract end<input type="date" name="end_date" required/></label>
   <label>Purchased hours<input type="number" name="purchased_hours" min={0.25} max={100000} step={0.25} required/></label>
   <label>Total contract cost<input type="number" name="total_cost" min={0} max={1000000} step={0.01} defaultValue="0" required/></label>
   <label>Currency<select name="currency" defaultValue="CAD"><option value="CAD">CAD</option><option value="USD">USD</option></select></label></div>
  <p className="field-help">Cost is commissioner-only. Purchased hours are the contract commitment; assign matching inventory slots to track usage. Utilized cost is a proportional estimate, not an invoice or refund calculation.</p>
  <button className="primary" disabled={pending||!rinks.length}>{pending?"Saving…":"Save ice contract"}</button>
  <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}
export function IceSlotContractForm({slotId,slotDate,rinkId,contractId,contracts}:{slotId:string;slotDate:string;rinkId:string;contractId:string|null;contracts:{id:string;title:string;rink_id:string;start_date:string;end_date:string;status:"active"|"cancelled"}[]}){
 const [state,action,pending]=useActionState(assignIceSlotContract,scheduleInitial);
 const assigned=contracts.find(contract=>contract.id===contractId);
 const matching=contracts.filter(contract=>contract.status==="active"&&contract.rink_id===rinkId&&contract.start_date<=slotDate&&slotDate<=contract.end_date);
 return <form action={action} className="form-stack">
  <input type="hidden" name="slot_id" value={slotId}/>
  <label>Contract<select name="contract_id" defaultValue={contractId??""}><option value="">Unassigned</option>{assigned?.status==="cancelled"&&<option value={assigned.id} disabled>{assigned.title} (cancelled)</option>}{matching.map(contract=><option key={contract.id} value={contract.id}>{contract.title}</option>)}</select></label>
  <label>Reason for assignment change<input name="reason" required minLength={3} maxLength={500}/></label>
  <button className="button" disabled={pending}>{pending?"Saving…":"Save assignment"}</button>
  <span role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</span>
 </form>;
}
export function IceContractCancelForm({contractId}:{contractId:string}){
 const [state,action,pending]=useActionState(cancelIceContract,scheduleInitial);
 return <form action={action} className="form-stack"><input type="hidden" name="contract_id" value={contractId}/>
  <label>Cancellation reason<input name="reason" required minLength={3} maxLength={500}/></label>
  <button className="button" disabled={pending}>{pending?"Cancelling…":"Cancel contract"}</button>
  <span role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</span>
 </form>;
}
export function IceSlotRemoveForm({id,used}:{id:string;used:boolean}){
 const [state,action,pending]=useActionState(removeIceSlot,scheduleInitial);
 return used?<span>In use</span>:<form action={action}><input type="hidden" name="slot_id" value={id}/><button className="button" disabled={pending}>{pending?"Removing…":"Remove"}</button><span role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</span></form>;
}
export function ScheduleGeneratorForm({divisions,entries}:{divisions:{id:string;name:string;season_name:string}[];entries:Entry[]}){
 const [state,action,pending]=useActionState(generateSchedule,scheduleInitial);
 const ready=divisions.some(division=>entries.some(entry=>entry.division_id===division.id));
 return <form action={action} className="panel form-stack"><h2>Generate a fair draft schedule</h2><label>Division<select name="division_id" required defaultValue=""><option value="" disabled>Select division</option>{divisions.map(division=><option key={division.id} value={division.id}>{division.season_name} · {division.name}</option>)}</select></label>
 <div className="settings-grid"><label>Season start<input type="date" name="start_date" required/></label><label>Season end<input type="date" name="end_date" required/></label>
 <label>Round robins<input type="number" name="round_robins" min={1} max={4} defaultValue={1} required/></label>
 <label>Maximum games per team per week<input type="number" name="max_games_per_week" min={1} max={7} defaultValue={1} required/></label>
 <label>Minimum rest between games (hours)<input type="number" name="min_rest_hours" min={0} max={168} defaultValue={0} required/></label></div>
 <fieldset><legend>Preferred game nights (soft preference)</legend><div className="settings-grid">{[["1","Monday"],["2","Tuesday"],["3","Wednesday"],["4","Thursday"],["5","Friday"],["6","Saturday"],["7","Sunday"]].map(([value,label])=><label key={value}><input type="checkbox" name="preferred_weekdays" value={value}/>{label}</label>)}</div></fieldset>
 <label>Existing generated draft schedule<select name="replace_existing_drafts" defaultValue="false"><option value="false">Keep it — generation will stop if drafts already exist</option><option value="true">Replace it — cancel old generated drafts and create new ones</option></select></label>
 <p className="field-help">Creates commissioner-only draft games. Every required slot in the date range is used; team blackouts, weekly limits, rest, and existing bookings are hard constraints. Fairness is a heuristic and must be reviewed before publishing.</p>
 <button className="primary" disabled={pending||!ready}>{pending?"Generating…":"Generate draft schedule"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function PublishScheduleForm({plan}:{plan:{division_id:string;division_name:string;season_name:string;start_date:string;end_date:string}}){
 const [state,action,pending]=useActionState(publishSchedule,scheduleInitial);
 return <form action={action} className="panel form-stack"><h3>{plan.season_name} · {plan.division_name}</h3><input type="hidden" name="division_id" value={plan.division_id}/><input type="hidden" name="start_date" value={plan.start_date}/><input type="hidden" name="end_date" value={plan.end_date}/>
 <p>Publish generated draft games scheduled from {plan.start_date} through {plan.end_date}.</p>
 <label><input type="checkbox" name="confirm" value="yes" required/> I reviewed the generated draft games and want to publish them to the league.</label>
 <button className="primary" disabled={pending}>{pending?"Publishing…":"Publish generated games"}</button><p className={"form-message"+(state.error?" error":"")} role="status">{state.message}</p></form>;
}
export function BlackoutForm({divisions,entries}:{divisions:{id:string;name:string;season_name:string}[];entries:Entry[]}){
 const [state,action,pending]=useActionState(saveBlackout,scheduleInitial);
 const [divisionId,setDivisionId]=useState("");
 return <form action={action} className="panel form-stack"><h2>Add a team blackout</h2><label>Division<select name="division_id" required value={divisionId} onChange={event=>setDivisionId(event.target.value)}><option value="" disabled>Select division</option>{divisions.map(division=><option key={division.id} value={division.id}>{division.season_name} · {division.name}</option>)}</select></label>
 <label>Team<select name="entry_id" required defaultValue="" key={divisionId}><option value="" disabled>Select team</option>{entries.filter(entry=>entry.division_id===divisionId).map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
 <label>Blackout date<input name="blackout_date" type="date" required/></label><input type="hidden" name="remove" value="false"/>
 <button className="button primary" disabled={pending||!divisions.length||!entries.length}>{pending?"Saving…":"Add blackout"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function BlackoutRemoveForm({blackout,divisionId}:{blackout:ScheduleBlackout;divisionId:string}){
 const [state,action,pending]=useActionState(saveBlackout,scheduleInitial);
 return <form action={action}><input type="hidden" name="division_id" value={divisionId}/><input type="hidden" name="entry_id" value={blackout.team_entry_id}/><input type="hidden" name="blackout_date" value={blackout.blackout_date}/><input type="hidden" name="remove" value="true"/>
 <button className="button" disabled={pending}>{pending?"Removing…":"Remove blackout"}</button><span role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</span></form>;
}
