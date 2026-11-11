"use client";

import {useEffect,useState} from "react";
import {clockLabel,type LiveScoreboardData} from "@/lib/live-scoreboard";

export function LiveScoreboard({initial,homeName,awayName}:{initial:LiveScoreboardData;homeName:string;awayName:string}){
 const [board,setBoard]=useState(initial);
 const [connection,setConnection]=useState<"connecting"|"live"|"reconnecting">("connecting");

 useEffect(()=>{
  let stopped=false;
  let timer:ReturnType<typeof setTimeout>;
  let controller:AbortController|undefined;
  const poll=async()=>{
   if(stopped) return;
   if(document.visibilityState==="hidden"){
    timer=setTimeout(poll,5000);
    return;
   }
   controller=new AbortController();
   try{
    const response=await fetch(`/api/games/${initial.game_id}/live`,{cache:"no-store",signal:controller.signal});
    if(!response.ok) throw new Error("Live score request failed.");
    const next=await response.json() as LiveScoreboardData;
    if(!stopped){setBoard(next);setConnection("live");}
   }catch(error){
    if(!stopped&&!(error instanceof DOMException&&error.name==="AbortError")) setConnection("reconnecting");
   }finally{
    if(!stopped) timer=setTimeout(poll,3000);
   }
  };
  void poll();
  return ()=>{stopped=true;clearTimeout(timer);controller?.abort();};
 },[initial.game_id]);

 return <section className="panel live-scoreboard" aria-label="Live game scoreboard">
  <div className="live-score-heading"><span className="live-indicator" aria-hidden="true"/>LIVE SCORE · {connection==="live"?"Connected":connection==="connecting"?"Connecting…":"Reconnecting…"}</div>
  <div className="live-score-teams"><strong>{homeName}</strong><span>{board.home_score} – {board.away_score}</span><strong>{awayName}</strong></div>
  <p className="field-help">Updates automatically every 3 seconds while this page is open. Scores are provisional until an official approves the final result.</p>
  <h2>Live event feed</h2>
  {board.events.length?<ol className="live-event-feed">{board.events.map(event=><li key={event.id}>
   <time dateTime={event.recorded_at}>{event.event_kind==="goal"?"GOAL":`PENALTY · ${event.penalty_minutes} min`}</time>
   <span>{event.team_entry_id===board.home_entry_id?homeName:awayName}</span>
   <span>Period {event.period} · {clockLabel(event.clock_seconds_remaining)} remaining</span>
  </li>)}</ol>:<p>No events recorded yet.</p>}
  <small>Latest saved update: <time dateTime={board.snapshot_at}>{new Date(board.snapshot_at).toLocaleTimeString()}</time></small>
 </section>;
}
