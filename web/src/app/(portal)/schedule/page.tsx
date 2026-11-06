import Link from "next/link";
import {randomUUID} from "node:crypto";
import {getLeagueData} from "@/lib/league";
import {getLeagueContext} from "@/lib/supabase/session";
import {VenueForm,RinkForm,GameForm} from "@/components/schedule-forms";
import type {Venue,Rink,Game,Entry} from "@/lib/schedule-schema";
export const dynamic="force-dynamic";
export default async function SchedulePage({searchParams}:{searchParams:Promise<{edit?:string}>}){
 const {edit}=await searchParams;
 const {supabase,league,user,canManage}=await getLeagueContext();
 const base=await getLeagueData();
 const [venues,rinks,games,rawEntries,ownAssignments]=await Promise.all([
  supabase.from("venues").select("id,name,address,time_zone").eq("league_id",league.id).order("name").returns<Venue[]>(),
  supabase.from("rinks").select("id,name,venue_id").eq("league_id",league.id).order("name").returns<Rink[]>(),
  supabase.from("games").select("id,home_entry_id,away_entry_id,rink_id,starts_at,ends_at,status,revision").eq("league_id",league.id).order("starts_at").returns<Game[]>(),
  supabase.from("team_entries").select("id,team_id,division_id").eq("league_id",league.id),
  supabase.from("game_officials").select("game_id").eq("league_id",league.id).eq("user_id",user.id),
 ]);
 if(venues.error||rinks.error||games.error||rawEntries.error) return <section className="panel empty"><h1>Schedule setup is pending.</h1><p>The scheduling database migration must be applied before fixtures and venues can be managed.</p></section>;
 const scorekeepingIds=new Set(ownAssignments.data?.map(assignment=>assignment.game_id)??[]);
 const entries:Entry[]=rawEntries.data.map(entry=>{
  const team=base.teams.find(t=>t.entry_id===entry.id);
  return {...entry,label:team?team.name+" · "+team.season_name+" / "+team.division_name:"Unavailable team"};
 });
 const entryLabel=(id:string)=>base.teams.find(t=>t.entry_id===id)?.name??"Unavailable team";
 const editing=games.data.find(game=>game.id===edit);
 const newId=randomUUID();
 return <><div className="page-heading"><div><p className="eyebrow">GAME DAY</p><h1>Every game, in its place.</h1><p>{league.name} · Times shown in each venue’s local time zone.</p></div><span className="badge">{games.data.filter(g=>g.status==="scheduled").length} SCHEDULED</span></div>
 <section className="panel"><h2>League schedule</h2>{games.data.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Matchup</th><th scope="col">Start / duration</th><th scope="col">Venue / rink</th><th scope="col">Status</th>{(canManage||scorekeepingIds.size>0)&&<th scope="col">Manage</th>}</tr></thead><tbody>{games.data.map(game=>{
  const rink=rinks.data.find(r=>r.id===game.rink_id);
  const venue=venues.data.find(v=>v.id===rink?.venue_id);
  const time=new Intl.DateTimeFormat("en-CA",{timeZone:venue?.time_zone??"UTC",dateStyle:"medium",timeStyle:"short"}).format(new Date(game.starts_at));
  return <tr key={game.id}><td><strong>{entryLabel(game.home_entry_id)}</strong><br/>vs {entryLabel(game.away_entry_id)}</td><td><time dateTime={game.starts_at}>{time}</time><br/><small>{venue?.time_zone} · {(Date.parse(game.ends_at)-Date.parse(game.starts_at))/60000} min</small></td><td>{venue?.name}<br/><small>{rink?.name}</small></td><td><span className="badge">{game.status.toUpperCase()}</span></td>{(canManage||scorekeepingIds.size>0)&&<td>{(canManage||scorekeepingIds.has(game.id))&&game.status==="scheduled"&&<Link className="button" href={"/schedule/"+game.id+"/scorekeeping"}>Scorekeeping</Link>} {canManage&&<><Link className="button" href={"/schedule?edit="+game.id+"#game-form"}>Edit game</Link> <Link className="button" href={"/schedule/"+game.id+"/officials"}>Officials</Link></>}</td>}</tr>;
 })}</tbody></table></div>:<div className="empty"><h2>No games scheduled yet.</h2><p>{canManage?"Add a venue and rink, then choose two teams from the same division.":"Your commissioner will publish the schedule here."}</p></div>}</section>
 {canManage&&<>
 <div className="section-heading"><h2>{editing?"Update fixture":"Plan the next game"}</h2>{editing&&<Link href="/schedule" className="text-link">Create a new game instead →</Link>}</div>
 {edit&&!editing&&<p role="status">That game is not available in your selected league.</p>}
 <div id="game-form"><GameForm key={editing?editing.id+":"+editing.revision:newId} id={editing?.id??newId} game={editing} venues={venues.data} rinks={rinks.data} entries={entries}/></div>
 <div className="section-heading"><h2>Venues and rinks</h2><span>{venues.data.length} venues · {rinks.data.length} rinks</span></div>
 <div className="roster-create"><VenueForm/><RinkForm venues={venues.data}/></div>
 <p className="field-help">This schedules games within your league. Use Officials beside a game to assign its referee and timekeeper crew.</p>
 </>}
 </>;
}
