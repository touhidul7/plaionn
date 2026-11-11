"use client";
import {useActionState,useState} from "react";
import {addGameEvent,voidGameEvent} from "@/app/(portal)/schedule/score-actions";
import {reopenGameResult,reviewGameResult,submitGameResult} from "@/app/(portal)/schedule/result-actions";
import type {GameScoreRosterMember} from "@/lib/game-event-schema";

const initial={error:false,message:""};

export function GameEventForm({gameId,clientEventId,homeEntryId,awayEntryId,periodCount,periodMinutes,roster}:{gameId:string;clientEventId:string;homeEntryId:string;awayEntryId:string;periodCount:number;periodMinutes:number;roster:GameScoreRosterMember[]}){
 const [state,action,pending]=useActionState(addGameEvent,initial);
 const [team,setTeam]=useState(homeEntryId);
 const [kind,setKind]=useState("goal");
 const [scorer,setScorer]=useState("");
 const [assistOne,setAssistOne]=useState("");
 const teamRoster=roster.filter(p=>p.team_entry_id===team);
 const eligibleRoster=teamRoster.filter(p=>p.eligible);
 const optionLabel=(p:GameScoreRosterMember)=>`${p.jersey_number===null?"":`#${p.jersey_number} `}${p.display_name} (${p.position})${p.eligible?"":` — INELIGIBLE: ${p.eligibility_reason}`}`;
 return <form action={action} className="panel form-stack">
  <h2>Record game event</h2>
  <input type="hidden" name="game_id" value={gameId}/>
  <input type="hidden" name="client_event_id" value={clientEventId}/>
  <div className="settings-grid">
   <label>Event<select name="event_kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="goal">Goal</option><option value="penalty">Penalty</option></select></label>
   <label>Team<select name="team_entry_id" required value={team} onChange={e=>{setTeam(e.target.value);setScorer("");setAssistOne("");}}><option value={homeEntryId}>Home</option><option value={awayEntryId}>Away</option></select></label>
   <label>Period<select name="period" required defaultValue="1">{Array.from({length:periodCount},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
   <label>Time remaining<input name="clock_remaining" required defaultValue={`${String(periodMinutes).padStart(2,"0")}:00`} pattern="\d{1,2}:[0-5]\d" placeholder="MM:SS"/></label>
   <label>Player<select name="player_id" required value={scorer} onChange={e=>{setScorer(e.target.value);setAssistOne("");}}><option value="" disabled>Select player</option>{teamRoster.map(p=><option key={p.player_id} value={p.player_id} disabled={!p.eligible}>{optionLabel(p)}</option>)}</select></label>
   {kind==="goal"?<><label>Assist 1<select name="assist_one_id" value={assistOne} onChange={e=>setAssistOne(e.target.value)}><option value="">None</option>{teamRoster.filter(p=>p.player_id!==scorer).map(p=><option key={p.player_id} value={p.player_id} disabled={!p.eligible}>{p.eligible?p.display_name:`${p.display_name} — INELIGIBLE: ${p.eligibility_reason}`}</option>)}</select></label>
   <label>Assist 2<select key={team+scorer+assistOne} name="assist_two_id" defaultValue=""><option value="">None</option>{teamRoster.filter(p=>p.player_id!==scorer&&p.player_id!==assistOne).map(p=><option key={p.player_id} value={p.player_id} disabled={!p.eligible}>{p.eligible?p.display_name:`${p.display_name} — INELIGIBLE: ${p.eligibility_reason}`}</option>)}</select></label><input type="hidden" name="penalty_minutes" value=""/></>:<><input type="hidden" name="assist_one_id" value=""/><input type="hidden" name="assist_two_id" value=""/><label>Penalty minutes<select name="penalty_minutes" defaultValue="2">{[2,4,5,10].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label></>}
  </div>
  <p className="field-help">Only eligible players can be selected. Ineligible players remain visible with the reason; a commissioner may grant a documented override. Saved events appear in the game log below.</p>
  <button className="primary" disabled={pending||!eligibleRoster.length}>{pending?"Saving…":"Save event"}</button>
  <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}

export function VoidGameEventForm({gameId,eventId}:{gameId:string;eventId:string}){
 const [state,action,pending]=useActionState(voidGameEvent,initial);
 return <form action={action} className="form-stack">
  <input type="hidden" name="event_id" value={eventId}/>
  <input type="hidden" name="game_id" value={gameId}/>
  <label>Correction reason<input name="reason" required minLength={3} maxLength={500}/></label>
  <button disabled={pending}>{pending?"Saving…":"Void event"}</button>
  <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}

export function SubmitGameResultForm({gameId,correction}:{gameId:string;correction:boolean}){
 const [state,action,pending]=useActionState(submitGameResult,initial);
 return <form action={action} className="panel form-stack">
  <h2>{correction?"Resubmit corrected result":"Submit final result"}</h2>
  <input type="hidden" name="game_id" value={gameId}/>
  {correction&&<label>Correction reason<input name="reason" required minLength={3} maxLength={500}/></label>}
  {!correction&&<input type="hidden" name="reason" value=""/>}
  <label>Game outcome<select name="decision" defaultValue="regulation">
   <option value="regulation">Regulation decision</option><option value="overtime">Overtime decision</option>
   <option value="shootout">Shootout decision</option><option value="tie">Tied game</option>
  </select></label>
  <p className="field-help">The score and penalty totals are calculated from the game log. A referee or another commissioner must review this result before it affects standings.</p>
  <button className="primary" disabled={pending}>{pending?"Submitting…":"Submit result for review"}</button>
  <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}

export function ReviewGameResultForm({gameId}:{gameId:string}){
 const [state,action,pending]=useActionState(reviewGameResult,initial);
 return <form action={action} className="panel form-stack">
  <h2>Review final result</h2>
  <input type="hidden" name="game_id" value={gameId}/>
  <label>Review reason<input name="reason" required minLength={3} maxLength={500}/></label>
  <div className="settings-grid"><button className="primary" name="decision" value="approve" disabled={pending}>{pending?"Saving…":"Approve result"}</button>
   <button name="decision" value="correction" disabled={pending}>Return for correction</button></div>
  <p className="field-help">Approval adds the result to official standings. Returning it removes it from standings and lets the scorer correct the event log.</p>
  <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}

export function ReopenGameResultForm({gameId}:{gameId:string}){
 const [state,action,pending]=useActionState(reopenGameResult,initial);
 return <form action={action} className="panel form-stack">
  <h2>Correct approved result</h2>
  <input type="hidden" name="game_id" value={gameId}/>
  <label>Correction reason<input name="reason" required minLength={3} maxLength={500}/></label>
  <p className="field-help">Reopening removes this result from official standings until the corrected event log is resubmitted and independently approved.</p>
  <button disabled={pending}>{pending?"Reopening…":"Reopen result for correction"}</button>
  <p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>
 </form>;
}
