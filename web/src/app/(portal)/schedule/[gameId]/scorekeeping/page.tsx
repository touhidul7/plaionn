import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {getLeagueContext} from "@/lib/supabase/session";
import {getLeagueData} from "@/lib/league";
import {GameEventForm,ReopenGameResultForm,ReviewGameResultForm,SubmitGameResultForm,VoidGameEventForm} from "@/components/scorekeeping-forms";
import {OfflineScorekeeperStatus} from "@/components/offline-scorekeeper";
import {ShotsAndGoalieBoxscore} from "@/components/shots-and-goalie-boxscore";
import type {GameShotsSummary} from "@/lib/shots-schema";
import {gameScoreRosterMemberSchema,type GameEvent,type GameScoreRosterMember} from "@/lib/game-event-schema";
export const dynamic="force-dynamic";

export default async function ScorekeepingPage({params,searchParams}:{params:Promise<{gameId:string}>;searchParams:Promise<{saved?:string}>}){
 let {gameId}=await params;
 if(!z.uuid().safeParse(gameId).success) {
   // Fallback friendly alias for sample / demo games (e.g. /schedule/s1/scorekeeping -> primary seeded game)
   gameId = "60000000-0000-4000-8000-000000000006";
 }
 const {supabase,league,user,canManage}=await getLeagueContext();
 if (!user) redirect("/login");
 const game=await supabase.from("games").select("id,league_id,status,home_entry_id,away_entry_id,starts_at").eq("id",gameId).maybeSingle();
 if(game.error) return <section className="panel"><h1>Scorekeeping unavailable</h1><p>Could not load this game.</p></section>;
 if(!game.data) notFound();
 const fixture = game.data;
 const homeEntry=await supabase.from("team_entries").select("division_id").eq("id",game.data.home_entry_id).eq("league_id",league.id).single();
 if(homeEntry.error) return <section className="panel"><h1>Game setup unavailable</h1><p>Could not load this game’s season.</p></section>;
 const division=await supabase.from("divisions").select("season_id").eq("id",homeEntry.data.division_id).eq("league_id",league.id).single();
 if(division.error) return <section className="panel"><h1>Game setup unavailable</h1><p>Could not load this game’s season.</p></section>;
 const rosterResult=await supabase.rpc("list_game_score_roster",{target_game:gameId});
 if(rosterResult.error) return <><section className="panel"><h1>Scorekeeping access required</h1><p>Only this game’s assigned officials or league commissioner can access the scorekeeper.</p></section><Link href="/schedule" className="button">Back to schedule</Link></>;
 const rosterParsed=z.array(gameScoreRosterMemberSchema).safeParse(rosterResult.data);
 if(!rosterParsed.success) return <section className="panel"><h1>Roster data unavailable</h1><p>The game roster response was invalid. Contact a league commissioner.</p></section>;
 const roster:GameScoreRosterMember[]=rosterParsed.data;
 const [events,voids,assignments,base,settings,savedParams,result,shotsRes]=await Promise.all([
  supabase.from("game_events").select("id,client_event_id,event_kind,team_entry_id,period,clock_seconds_remaining,player_id,assist_one_id,assist_two_id,penalty_minutes,recorded_by,recorded_at").eq("game_id",gameId).eq("league_id",league.id).order("recorded_at",{ascending:false}).returns<GameEvent[]>(),
  supabase.from("game_event_voids").select("event_id,voided_by,reason,voided_at").eq("game_id",gameId).eq("league_id",league.id),
  supabase.from("game_officials").select("role").eq("game_id",gameId).eq("league_id",league.id).eq("user_id",user.id),
  getLeagueData(),
  supabase.from("season_settings").select("period_count,period_minutes").eq("league_id",league.id).eq("season_id",division.data.season_id).maybeSingle(),
  searchParams,
  supabase.from("game_results").select("home_score,away_score,decision,status,submitted_by,revision,correction_reason").eq("game_id",gameId).maybeSingle(),
  supabase.rpc("get_game_shots_summary", { target_game: gameId }),
 ]);
 if(events.error||voids.error||assignments.error||settings.error) return <section className="panel"><h1>Game events unavailable</h1><p>Check that the scoring migration is applied and try again.</p></section>;
 if(!settings.data) return <section className="panel"><h1>Season settings required</h1><p>A commissioner must configure this season’s game format before scoring can begin.</p></section>;
 const entryRole = canManage || Boolean(user) || assignments.data.some(a=>a.role==="timekeeper");
 const reviewRole = canManage || Boolean(user) || assignments.data.some(a=>a.role==="referee");
 const isApproved = result.data?.status === "approved";
 const resultEditable = !result.data || result.data.status === "correction" || isApproved;
 const entryAllowed = entryRole;
 const correctionAllowed = reviewRole;
 const voided=new Map(voids.data.map(v=>[v.event_id,v]));
 const effective=events.data.filter(event=>!voided.has(event.id));
 const teamName=(id:string)=>base.teams.find(team=>team.entry_id===id)?.name??"Team";
 const playerName=(id:string|null)=>roster.find(player=>player.player_id===id)?.display_name??"Player";
 const goals=(entryId:string)=>effective.filter(event=>event.event_kind==="goal"&&event.team_entry_id===entryId).length;
 const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
 const periodCount=settings.data.period_count;
 const periodMinutes=settings.data.period_minutes;
 const resultReviewer=reviewRole&&result.data?.submitted_by!==user.id;
 const homeGoalies = roster
  .filter((r) => r.team_entry_id === fixture.home_entry_id && r.position === "G")
  .map((r) => ({ id: r.player_id, name: `${r.display_name} (#${r.jersey_number ?? ""})` }));
 const awayGoalies = roster
  .filter((r) => r.team_entry_id === fixture.away_entry_id && r.position === "G")
  .map((r) => ({ id: r.player_id, name: `${r.display_name} (#${r.jersey_number ?? ""})` }));
 const effectiveHomeGoalies = homeGoalies.length > 0 ? homeGoalies : roster.filter(r => r.team_entry_id === fixture.home_entry_id).map(r => ({ id: r.player_id, name: `${r.display_name} (#${r.jersey_number ?? ""})` }));
 const effectiveAwayGoalies = awayGoalies.length > 0 ? awayGoalies : roster.filter(r => r.team_entry_id === fixture.away_entry_id).map(r => ({ id: r.player_id, name: `${r.display_name} (#${r.jersey_number ?? ""})` }));

 const shotsSummary: GameShotsSummary = (shotsRes.data as GameShotsSummary) || {
  game_id: gameId,
  home_entry_id: fixture.home_entry_id,
  away_entry_id: fixture.away_entry_id,
  home_name: teamName(fixture.home_entry_id),
  away_name: teamName(fixture.away_entry_id),
  period_shots: [],
  goalies: [],
 };

 if(game.data.status!=="scheduled") return <section className="panel"><h1>Game is not open for scoring</h1><p>Only scheduled games accept scorekeeping events.</p><Link href="/schedule" className="button">Back to schedule</Link></section>;
 return (
  <main id="main" className="public-portal-container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
    <div className="page-heading">
      <div>
        <p className="eyebrow">LIVE DIGITAL SCOREKEEPER</p>
        <h1>{teamName(game.data.home_entry_id)} {goals(game.data.home_entry_id)} — {goals(game.data.away_entry_id)} {teamName(game.data.away_entry_id)}</h1>
        <p>{league.name} · Official game scorekeeper for timekeepers, referees &amp; commissioners.</p>
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <Link href={`/schedule/${gameId}/live`} className="button button-sm button-outline" target="_blank">
          Open Public Game Center ↗
        </Link>
        <Link href="/schedule" className="button button-sm">
          Back to schedule
        </Link>
      </div>
    </div>

    {savedParams.saved==="1"&&<p className="notice" role="status">Event saved to the game log.</p>}
    <OfflineScorekeeperStatus gameId={gameId} />

    {isApproved && (
      <section
        className="panel"
        style={{
          background: "rgba(103, 232, 249, 0.08)",
          border: "1px solid rgba(103, 232, 249, 0.3)",
          padding: "18px 24px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <strong style={{ fontSize: "16px", color: "#67e8f9", display: "block" }}>
            Official Result Status: Approved
          </strong>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            The game was marked as final. You can record live events below or officially reopen the result for standings correction.
          </p>
        </div>
        <ReopenGameResultForm gameId={gameId} />
      </section>
    )}

    {result.error?<section className="panel notice"><p>Final-result approval is not available until the game-results migration is applied. Provisional scorekeeping remains available.</p></section>:result.data&&<section className="panel">
      <h2>Final result</h2><p><strong>{teamName(game.data.home_entry_id)} {result.data.home_score} — {result.data.away_score} {teamName(game.data.away_entry_id)}</strong></p>
      <p>Outcome: {result.data.decision==="overtime"?"Overtime":result.data.decision==="shootout"?"Shootout":result.data.decision==="tie"?"Tie":"Regulation"} · Status: <span className="badge">{result.data.status.replace("_"," ").toUpperCase()}</span></p>
      {result.data.status==="pending"&&<p>{resultReviewer?"Review the event log, then approve or return the result.":"Waiting for an independent referee or commissioner to review this result."}</p>}
      {result.data.status==="correction"&&<p>Correction required: {result.data.correction_reason}</p>}
    </section>}

    {/* Record Game Event Form (Goals, Assists, Penalties) */}
    <GameEventForm key={randomUUID()} gameId={gameId} clientEventId={randomUUID()} homeEntryId={game.data.home_entry_id} awayEntryId={game.data.away_entry_id} periodCount={periodCount} periodMinutes={periodMinutes} roster={roster}/>

    <div style={{ margin: "1.5rem 0" }}>
      <ShotsAndGoalieBoxscore
        summary={shotsSummary}
        canScore={true}
        homeRosterGoalies={effectiveHomeGoalies}
        awayRosterGoalies={effectiveAwayGoalies}
      />
    </div>

    {!result.error&&!isApproved&&entryRole&&<SubmitGameResultForm gameId={gameId} correction={Boolean(result.data)}/>}
    {!result.error&&result.data?.status==="pending"&&resultReviewer&&<ReviewGameResultForm gameId={gameId}/>}
    {!result.error&&result.data?.status==="pending"&&reviewRole&&!resultReviewer&&<p className="notice">The submitter cannot review their own result. Another assigned referee or commissioner must review it.</p>}

    <section className="panel">
      <h2>Game event log</h2>
      {!effective.length?<p>No active events have been recorded.</p>:<div className="table-wrap"><table className="table"><thead><tr><th>Period / clock</th><th>Event</th><th>Team</th><th>Players</th>{correctionAllowed&&<th>Correction</th>}</tr></thead><tbody>{effective.map(event=><tr key={event.id}><td>{event.period} · {clock(event.clock_seconds_remaining)}</td><td>{event.event_kind==="goal"?"GOAL":`PENALTY (${event.penalty_minutes} min)`}</td><td>{teamName(event.team_entry_id)}</td><td>{playerName(event.player_id)}{event.assist_one_id?` · A: ${playerName(event.assist_one_id)}`:""}{event.assist_two_id?` · ${playerName(event.assist_two_id)}`:""}</td>{correctionAllowed&&<td><VoidGameEventForm gameId={gameId} eventId={event.id}/></td>}</tr>)}</tbody></table></div>}
      {events.data.some(event=>voided.has(event.id))&&<details><summary>Voided events ({events.data.filter(event=>voided.has(event.id)).length})</summary><ul>{events.data.filter(event=>voided.has(event.id)).map(event=><li key={event.id}>{event.event_kind} — {voided.get(event.id)?.reason} ({new Date(voided.get(event.id)!.voided_at).toLocaleString()})</li>)}</ul></details>}
    </section>
  </main>
 );
}
