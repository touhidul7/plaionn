"use client";
import {useActionState,useState} from "react";
import {addGameEvent,voidGameEvent} from "@/app/(portal)/schedule/score-actions";
import type {GameScoreRosterMember} from "@/lib/game-event-schema";

const initial={error:false,message:""};

export function GameEventForm({gameId,clientEventId,homeEntryId,awayEntryId,periodCount,periodMinutes,roster}:{gameId:string;clientEventId:string;homeEntryId:string;awayEntryId:string;periodCount:number;periodMinutes:number;roster:GameScoreRosterMember[]}){
 const [state,action,pending]=useActionState(addGameEvent,initial);
 const [team,setTeam]=useState(homeEntryId);
 const [kind,setKind]=useState("goal");
 const [scorer,setScorer]=useState("");
 const [assistOne,setAssistOne]=useState("");
 const teamRoster=roster.filter(p=>p.team_entry_id===team);
 return <form action={action} className="panel form-stack">
  <h2>Record game event</h2>
  <input type="hidden" name="game_id" value={gameId}/>
  <input type="hidden" name="client_event_id" value={clientEventId}/>
  <div className="settings-grid">
   <label>Event<select name="event_kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="goal">Goal</option><option value="penalty">Penalty</option></select></label>
   <label>Team<select name="team_entry_id" required value={team} onChange={e=>{setTeam(e.target.value);setScorer("");setAssistOne("");}}><option value={homeEntryId}>Home</option><option value={awayEntryId}>Away</option></select></label>
   <label>Period<select name="period" required defaultValue="1">{Array.from({length:periodCount},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
   <label>Time remaining<input name="clock_remaining" required defaultValue={`${String(periodMinutes).padStart(2,"0")}:00`} pattern="\d{1,2}:[0-5]\d" placeholder="MM:SS"/></label>
   <label>Player<select name="player_id" required value={scorer} onChange={e=>{setScorer(e.target.value);setAssistOne("");}}><option value="" disabled>Select player</option>{teamRoster.map(p=><option key={p.player_id} value={p.player_id}>{p.jersey_number===null?"":`#${p.jersey_number} `}{p.display_name} ({p.position})</option>)}</select></label>
   {kind==="goal"?<><label>Assist 1<select name="assist_one_id" value={assistOne} onChange={e=>setAssistOne(e.target.value)}><option value="">None</option>{teamRoster.filter(p=>p.player_id!==scorer).map(p=><option key={p.player_id} value={p.player_id}>{p.display_name}</option>)}</select></label>
   <label>Assist 2<select key={team+scorer+assistOne} name="assist_two_id" defaultValue=""><option value="">None</option>{teamRoster.filter(p=>p.player_id!==scorer&&p.player_id!==assistOne).map(p=><option key={p.player_id} value={p.player_id}>{p.display_name}</option>)}</select></label><input type="hidden" name="penalty_minutes" value=""/></>:<><input type="hidden" name="assist_one_id" value=""/><input type="hidden" name="assist_two_id" value=""/><label>Penalty minutes<select name="penalty_minutes" defaultValue="2">{[2,4,5,10].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label></>}
  </div>
  <p className="field-help">Select an active player from the chosen team. Saved events appear in the game log below.</p>
  <button className="primary" disabled={pending||!teamRoster.length}>{pending?"Saving…":"Save event"}</button>
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
