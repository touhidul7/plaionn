import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {getLeagueContext} from "@/lib/supabase/session";
import {getLeagueData} from "@/lib/league";
import {OfficialForm} from "@/components/official-form";
import {officialSlots,type Assignment} from "@/lib/official-schema";
export const dynamic="force-dynamic";
export default async function OfficialsPage({params}:{params:Promise<{gameId:string}>}){
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return <section className="panel"><h1>Commissioner access required</h1><Link href="/schedule">Back to schedule</Link></section>;
 const {gameId}=await params;
 if(!z.uuid().safeParse(gameId).success) notFound();
 const game=await supabase.from("games").select("id,revision,status,starts_at,home_entry_id,away_entry_id").eq("league_id",league.id).eq("id",gameId).maybeSingle();
 if(game.error) return <section className="panel"><h1>Game unavailable</h1><p>Please try again.</p></section>;
 if(!game.data) notFound();
 const [directory,assigned,history,base]=await Promise.all([
  supabase.rpc("list_league_officials",{target_league:league.id}),
  supabase.from("game_officials").select("slot,user_id").eq("game_id",gameId).eq("league_id",league.id).returns<Assignment[]>(),
  supabase.from("official_assignment_audit").select("id,changed_at,reason,previous_record,new_record").eq("game_id",gameId).eq("league_id",league.id).order("changed_at",{ascending:false}).limit(20),
  getLeagueData(),
 ]);
 if(directory.error||assigned.error||history.error) return <section className="panel"><h1>Assignments unavailable</h1><p>Please try again after the officials module is configured.</p><Link href="/schedule">Back to schedule</Link></section>;
 const parsedDirectory=z.array(z.object({user_id:z.string(),role:z.string(),label:z.string()})).safeParse(directory.data);
 if(!parsedDirectory.success) return <section className="panel"><h1>Officials unavailable</h1><p>Please reload and try again.</p></section>;
 const officials=parsedDirectory.data;
 const team=(id:string)=>base.teams.find(t=>t.entry_id===id)?.name??"Team";
 const name=(id:string)=>officials.find(o=>o.user_id===id)?.label??id;
 return <><div className="page-heading"><div><p className="eyebrow">GAME OFFICIALS</p><h1>{team(game.data.home_entry_id)} vs {team(game.data.away_entry_id)}</h1><p>{game.data.status.toUpperCase()} · {new Intl.DateTimeFormat("en-CA",{timeZone:"UTC",dateStyle:"medium",timeStyle:"short"}).format(new Date(game.data.starts_at))} UTC</p></div><Link href="/schedule" className="button">Back to schedule</Link></div>
 <section className="panel"><h2>Assigned crew</h2>{officialSlots.map(slot=><p key={slot.id}><strong>{slot.label}: </strong>{assigned.data.find(a=>a.slot===slot.id)?name(assigned.data.find(a=>a.slot===slot.id)!.user_id):"Unassigned"}</p>)}{!officials.length&&<p>No referee or timekeeper accounts are available in this league.</p>}</section>
 <OfficialForm gameId={gameId} revision={game.data.revision} officials={officials} assignments={assigned.data} cancelled={game.data.status==="cancelled"}/>
 <section className="panel"><h2>Recent assignment changes</h2>{history.data.length?<ul>{history.data.map(item=><li key={item.id}><time dateTime={item.changed_at}>{new Date(item.changed_at).toISOString().replace("T"," ").slice(0,19)} UTC</time> — {item.reason}<br/>{item.new_record?`${item.new_record.slot}: ${name(item.new_record.user_id)}`:`Removed ${item.previous_record?.slot??"empty assignment"}`}</li>)}</ul>:<p>No assignment changes yet.</p>}</section></>;
}
