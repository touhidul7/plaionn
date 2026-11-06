"use client";
import {useActionState} from "react";
import {submitRegistration,decideRegistration,publishRegistration} from "@/app/(portal)/registration/actions";
import type {OpenSeason} from "@/lib/registration-schema";
const initial={error:false,message:""};
export function RegistrationForm({seasons,name}:{seasons:OpenSeason[];name?:string}){
 const [state,action,pending]=useActionState(submitRegistration,initial);
 return <form action={action} className="panel form-stack"><h2>Apply for a season</h2><label>Season<select name="season_id" required defaultValue=""><option value="" disabled>Select a season</option>{seasons.map(s=><option key={s.season_id} value={s.season_id}>{s.league_name} · {s.season_name} (closes {s.closes} UTC)</option>)}</select></label>
 <label>Player name<input name="display_name" required minLength={2} maxLength={100} defaultValue={name??""} readOnly={!!name}/></label>
 <label>Preferred position<select name="position" defaultValue="F">{["C","LW","RW","D","G","F"].map(p=><option key={p}>{p}</option>)}</select></label>
 <p className="field-help">Your application is reviewed by the league. Approval does not confirm a team place, payment, waiver acceptance, or game eligibility.</p>
 <button disabled={pending||!seasons.length}>{pending?"Submitting…":"Submit application"}</button><p role="status" className={state.error?"form-message error":"form-message"}>{state.message}</p></form>;
}
export function RegistrationDecision({id,revision,review=false}:{id:string;revision:number;review?:boolean}){
 const [state,action,pending]=useActionState(decideRegistration,initial);
 return <form action={action} className="form-stack"><input type="hidden" name="registration_id" value={id}/><input type="hidden" name="revision" value={revision}/>
 {review?<label>Decision<select name="decision"><option value="approved">Approve registration</option><option value="rejected">Reject application</option></select></label>:<input type="hidden" name="decision" value="withdrawn"/>}
 <label>{review?"Review reason (visible to applicant)":"Reason for withdrawing"}<input name="reason" required minLength={3} maxLength={500}/></label><button disabled={pending}>{pending?"Saving…":review?"Save decision":"Withdraw application"}</button><p role="status" className={state.error?"form-message error":"form-message"}>{state.message}</p></form>;
}
export function RegistrationPublication({seasonId,revision,enabled}:{seasonId:string;revision:number;enabled:boolean}){
 const [state,action,pending]=useActionState(publishRegistration,initial);
 return <form action={action}><input type="hidden" name="season_id" value={seasonId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="enabled" value={String(!enabled)}/><button disabled={pending}>{pending?"Saving…":enabled?"Close applications":"Publish registration"}</button><p role="status">{state.message}</p></form>;
}
