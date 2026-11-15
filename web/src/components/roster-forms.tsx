"use client";
import Link from "next/link";
import {useActionState} from "react";
import {createPlayer,saveRoster,grantEligibilityOverride,revokeEligibilityOverride} from "@/app/(portal)/teams/roster-actions";
import type {PlayerOption,RosterRow,TeamEligibility} from "@/lib/roster-schema";
const positions=[["F","Forward"],["C","Centre"],["LW","Left wing"],["RW","Right wing"],["D","Defence"],["G","Goalie"]];
export function PlayerForm(){
 const [state,action,pending]=useActionState(createPlayer,{error:false,message:"",revision:0});
 return <form action={action} className="panel form-stack"><h2>Create a player profile</h2><p>Check the existing player list first. Players with matching names are not merged automatically.</p><label>Player name<input name="display_name" required minLength={2} maxLength={100} autoComplete="off"/></label><button className="button primary" disabled={pending}>{pending?"Creating…":"Create player"}</button><p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p></form>;
}
export function RosterForm({entryId,players,row}:{entryId:string;players:PlayerOption[];row?:RosterRow}){
 const [state,action,pending]=useActionState(saveRoster,{error:false,message:"",revision:row?.revision??0});
 return <form action={action} className="panel form-stack">
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <h2 style={{ margin: 0 }}>
      {row ? (
        <Link href={`/players/${row.player_id}`} className="text-link" title="View player profile">
          {players.find(p=>p.id===row.player_id)?.display_name ?? "Player"} ↗
        </Link>
      ) : "Add an existing player"}
    </h2>
  </div>
 <input type="hidden" name="team_entry_id" value={entryId}/><input type="hidden" name="revision" value={state.revision}/>
 {row?<input type="hidden" name="player_id" value={row.player_id}/>:<label>Player<select name="player_id" required defaultValue=""><option value="" disabled>Select a player</option>{players.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.id.slice(0,8)}</option>)}</select></label>}
 <div className="settings-grid"><label>Jersey number<input name="jersey_number" type="number" min={0} max={99} step={1} defaultValue={row?.jersey_number??""}/></label>
 <label>Position<select name="position" defaultValue={row?.position??"F"}>{positions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Roster status<select name="status" defaultValue={row?.status??"active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
 <button className="primary" disabled={pending||(!row&&!players.length)}>{pending?"Saving…":row?"Save player":"Add to roster"}</button>
 <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}
export function EligibilityCard({entryId,eligibility}:{entryId:string;eligibility:TeamEligibility}){
 const initial={error:false,message:"",revision:0};
 const [grantState,grantAction,grantPending]=useActionState(grantEligibilityOverride,initial);
 const [revokeState,revokeAction,revokePending]=useActionState(revokeEligibilityOverride,initial);
 return <section className="panel eligibility-card">
  <h3>{eligibility.display_name} · {eligibility.status}</h3>
  <p className={eligibility.eligible?"eligibility-ok":"eligibility-blocked"}>{eligibility.eligible?"Eligible":"Not eligible"}: {eligibility.reason}</p>
  {eligibility.override_id&&<p>Override reason: {eligibility.override_reason}</p>}
  {eligibility.override_id?
   <form action={revokeAction} className="form-stack">
    <input type="hidden" name="override_id" value={eligibility.override_id}/><input type="hidden" name="team_entry_id" value={entryId}/>
    <label>Revoke override reason<input name="reason" required minLength={3} maxLength={500}/></label>
    <button disabled={revokePending}>{revokePending?"Saving…":"Revoke override"}</button>
    <p role="status" className={revokeState.error?"form-message error":"form-message"}>{revokeState.message}</p>
   </form>
   :!eligibility.eligible&&eligibility.status==="active"&&<form action={grantAction} className="form-stack">
    <input type="hidden" name="roster_membership_id" value={eligibility.roster_membership_id}/><input type="hidden" name="team_entry_id" value={entryId}/>
    <label>Commissioner override reason<input name="reason" required minLength={3} maxLength={500}/></label>
    <button disabled={grantPending}>{grantPending?"Saving…":"Grant eligibility override"}</button>
    <p role="status" className={grantState.error?"form-message error":"form-message"}>{grantState.message}</p>
   </form>}
 </section>;
}
