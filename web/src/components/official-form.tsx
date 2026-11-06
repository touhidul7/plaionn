"use client";
import {useActionState,useState} from "react";
import {saveOfficial} from "@/app/(portal)/schedule/official-actions";
import {officialSlots,type Official,type Assignment} from "@/lib/official-schema";
export function OfficialForm({gameId,revision,officials,assignments,cancelled}:{gameId:string;revision:number;officials:Official[];assignments:Assignment[];cancelled:boolean}){
 const [state,action,pending]=useActionState(saveOfficial,{error:false,message:""});
 const [slot,setSlot]=useState("timekeeper");
 const role=officialSlots.find(s=>s.id===slot)!.role;
 return <form action={action} className="panel form-stack"><h2>Manage assignment</h2>
 <input name="game_id" type="hidden" value={gameId}/><input name="revision" type="hidden" value={revision}/>
 <label>Game role<select name="slot" value={slot} onChange={e=>setSlot(e.target.value)}>{officialSlots.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 <label>Official<select name="user_id" key={slot+":"+revision} defaultValue={cancelled?"":assignments.find(a=>a.slot===slot)?.user_id??""}><option value="">Unassigned / remove assignment</option>{!cancelled&&officials.filter(o=>o.role===role).map(o=><option key={o.user_id} value={o.user_id}>{o.label}</option>)}</select></label>
 <label>Reason<input name="reason" required minLength={3} maxLength={500} placeholder="Covering this game"/></label>
 <p className="field-help">An official can hold one role per game. Overlapping assignments are blocked, including draft fixtures. Cancelled games release the booking.</p>
 <button disabled={pending}>{pending?"Saving…":"Save assignment"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}
