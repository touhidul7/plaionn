"use client";
import {useActionState} from "react";
import {createPlayer,saveRoster} from "@/app/(portal)/teams/roster-actions";
import type {PlayerOption,RosterRow} from "@/lib/roster-schema";
const positions=[["F","Forward"],["C","Centre"],["LW","Left wing"],["RW","Right wing"],["D","Defence"],["G","Goalie"]];
export function PlayerForm(){
 const [state,action,pending]=useActionState(createPlayer,{error:false,message:"",revision:0});
 return <form action={action} className="panel form-stack"><h2>Create a player profile</h2><p>Check the existing player list first. Players with matching names are not merged automatically.</p><label>Player name<input name="display_name" required minLength={2} maxLength={100} autoComplete="off"/></label><button disabled={pending}>{pending?"Creating…":"Create player"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function RosterForm({entryId,players,row}:{entryId:string;players:PlayerOption[];row?:RosterRow}){
 const [state,action,pending]=useActionState(saveRoster,{error:false,message:"",revision:row?.revision??0});
 return <form action={action} className="panel form-stack">
 <h2>{row?players.find(p=>p.id===row.player_id)?.display_name??"Player":"Add an existing player"}</h2>
 <input type="hidden" name="team_entry_id" value={entryId}/><input type="hidden" name="revision" value={state.revision}/>
 {row?<input type="hidden" name="player_id" value={row.player_id}/>:<label>Player<select name="player_id" required defaultValue=""><option value="" disabled>Select a player</option>{players.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.id.slice(0,8)}</option>)}</select></label>}
 <div className="settings-grid"><label>Jersey number<input name="jersey_number" type="number" min={0} max={99} step={1} defaultValue={row?.jersey_number??""}/></label>
 <label>Position<select name="position" defaultValue={row?.position??"F"}>{positions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Roster status<select name="status" defaultValue={row?.status??"active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
 <button className="primary" disabled={pending||(!row&&!players.length)}>{pending?"Saving…":row?"Save player":"Add to roster"}</button>
 <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}

