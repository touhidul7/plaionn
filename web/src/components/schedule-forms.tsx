"use client";
import {useActionState,useState} from "react";
import {createVenue,createRink,saveGame} from "@/app/(portal)/schedule/actions";
import {localGameTime,type Venue,type Rink,type Entry,type Game} from "@/lib/schedule-schema";
const initial={error:false,message:"",revision:0};
export function VenueForm(){
 const [state,action,pending]=useActionState(createVenue,initial);
 return <form action={action} className="panel form-stack"><h2>Add a venue</h2><label>Venue name<input name="name" required minLength={2} maxLength={100}/></label><label>Address<input name="address" maxLength={300}/></label><label>Time zone<input name="time_zone" defaultValue="America/Toronto" required list="venue-zones"/></label><datalist id="venue-zones">{["America/Toronto","America/Vancouver","America/Edmonton","America/Winnipeg","America/Halifax","Asia/Dhaka","UTC"].map(zone=><option key={zone} value={zone}/>)}</datalist><label>First rink name<input name="rink_name" required maxLength={100} placeholder="Rink 1"/></label><button disabled={pending}>{pending?"Saving…":"Create venue and rink"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function RinkForm({venues}:{venues:Venue[]}){
 const [state,action,pending]=useActionState(createRink,initial);
 return <form action={action} className="panel form-stack"><h2>Add another rink</h2><label>Venue<select name="venue_id" required defaultValue=""><option value="" disabled>Select venue</option>{venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>Rink name<input name="name" required maxLength={100}/></label><button disabled={pending||!venues.length}>{pending?"Saving…":"Create rink"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
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

