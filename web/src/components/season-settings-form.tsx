"use client";
import {useActionState} from "react";
import type {SeasonSettings} from "@/lib/season-settings-schema";
import {saveSettings} from "@/app/(portal)/league/settings/actions";
export function SeasonSettingsForm({seasonId,settings,canManage}:{seasonId:string;settings:SeasonSettings|null;canManage:boolean}){
 const [state,action,pending]=useActionState(saveSettings,{error:false,message:"",revision:settings?.revision??0});
 const number=(name:string,label:string,value:number,min:number,max:number)=><label>{label}<input type="number" name={name} defaultValue={value} required min={min} max={max} step="1"/></label>;
 return <form action={action} className="settings-form">
 <input type="hidden" name="season_id" value={seasonId}/><input type="hidden" name="revision" value={state.revision}/>
 {!settings&&<p className="notice">These are suggested starting values. A commissioner must review and save them for this season.</p>}
 <fieldset disabled={!canManage||pending}>
 <section className="panel"><h2>Roster and registration</h2><div className="settings-grid">
 {number("roster_limit","Maximum players per team",settings?.roster_limit??20,1,100)}
 <label>Registration opens<input type="date" name="registration_opens" defaultValue={settings?.registration_opens??""}/></label>
 <label>Registration closes<input type="date" name="registration_closes" defaultValue={settings?.registration_closes??""}/></label>
 </div><p className="field-help">Dates are calendar dates. Leave them blank when the registration window is undecided.</p></section>
 <section className="panel"><h2>Game format and standings points</h2><div className="settings-grid">
 {number("period_count","Number of periods",settings?.period_count??3,1,10)}
 {number("period_minutes","Minutes per period",settings?.period_minutes??20,1,60)}
 <label>Clock mode<select name="clock_mode" defaultValue={settings?.clock_mode??"stop"}><option value="stop">Stop time</option><option value="running">Running time</option></select></label>
 {number("win_points","Win points",settings?.win_points??2,0,10)}
 {number("tie_points","Tie points",settings?.tie_points??1,0,10)}
 {number("loss_points","Loss points",settings?.loss_points??0,0,10)}
 {number("overtime_loss_points","Overtime loss points",settings?.overtime_loss_points??1,0,10)}
 </div></section>
 <section className="panel"><h2>Standings tiebreakers</h2><div className="settings-grid">
 {[
  ["tiebreaker_priority_1","1st priority","wins"],
  ["tiebreaker_priority_2","2nd priority","goal_difference"],
  ["tiebreaker_priority_3","3rd priority","goals_for"],
  ["tiebreaker_priority_4","4th priority","head_to_head"],
  ["tiebreaker_priority_5","5th priority","fewest_penalties"],
 ].map(([name,label,fallback])=><label key={name}>{label}<select name={name} defaultValue={settings?.standings_tiebreakers?.[Number(name.at(-1))-1]??fallback}>
  <option value="wins">Wins</option>
  <option value="head_to_head">Head-to-head points</option>
  <option value="goal_difference">Goal difference</option>
  <option value="goals_for">Goals scored</option>
  <option value="fewest_penalties">Fewest penalty minutes</option>
 </select></label>)}
 </div><p className="field-help">Applied in order after standings points. Keep all five priorities distinct; teams still tied after these criteria share a position.</p></section>
 <section className="panel"><h2>Season fees</h2><div className="settings-grid">
 <label>Billing model<select name="billing_model" defaultValue={settings?.billing_model??"both"}><option value="team">League bills teams</option><option value="player">League bills players</option><option value="both">Both billing models</option></select></label>
 <label>Currency<select name="currency" defaultValue={settings?.currency??"CAD"}><option value="CAD">CAD — Canadian dollar</option><option value="USD">USD — US dollar</option></select></label>
 <label>Team fee<input name="team_fee_cents" inputMode="decimal" required defaultValue={((settings?.team_fee_cents??0)/100).toFixed(2)}/></label>
 <label>Player fee<input name="player_fee_cents" inputMode="decimal" required defaultValue={((settings?.player_fee_cents??0)/100).toFixed(2)}/></label>
 </div><p className="field-help">Saving fee settings does not charge anyone or change existing invoices.</p></section>
 </fieldset>
 {canManage?<button className="primary" disabled={pending}>{pending?"Saving…":"Save season settings"}</button>:<p>Only your league commissioner can change these settings.</p>}
 <p className={"form-message"+(state.error?" error":"")} role="status">{state.message}</p>
 </form>;
}
