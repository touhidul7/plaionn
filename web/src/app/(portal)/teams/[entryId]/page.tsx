import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {getLeagueContext} from "@/lib/supabase/session";
import {PlayerForm,RosterForm} from "@/components/roster-forms";
import type {PlayerOption,RosterRow} from "@/lib/roster-schema";
export const dynamic="force-dynamic";
export default async function TeamRosterPage({params}:{params:Promise<{entryId:string}>}){
 const {supabase,league,canManage}=await getLeagueContext();
 const {entryId}=await params;
 if(!z.uuid().safeParse(entryId).success) notFound();
 const entry=await supabase.from("team_entries").select("id,team_id,division_id").eq("id",entryId).eq("league_id",league.id).maybeSingle();
 if(entry.error) throw new Error("Unable to load this team.");
 if(!entry.data) notFound();
 const team=await supabase.from("teams").select("name").eq("id",entry.data.team_id).eq("league_id",league.id).single();
 if(team.error) throw new Error("Unable to load this team.");
 if(!canManage) return <section className="panel empty"><h1>{team.data.name}</h1><p>Private roster management is currently available to league commissioners.</p><Link href="/teams" className="button">Back to teams</Link></section>;
 const division=await supabase.from("divisions").select("season_id,name").eq("id",entry.data.division_id).eq("league_id",league.id).single();
 if(division.error) throw new Error("Unable to load this division.");
 const [roster,links,settings]=await Promise.all([
  supabase.from("roster_memberships").select("id,player_id,jersey_number,position,status,revision").eq("team_entry_id",entryId).eq("league_id",league.id).order("id").returns<RosterRow[]>(),
  supabase.from("league_players").select("player_id").eq("league_id",league.id),
  supabase.from("season_settings").select("roster_limit").eq("season_id",division.data.season_id).eq("league_id",league.id).maybeSingle(),
 ]);
 if(roster.error||links.error||settings.error) return <section className="panel empty"><h1>Roster setup is pending.</h1><p>The roster database migration needs to be applied before this team can be managed.</p><Link href="/teams" className="button">Back to teams</Link></section>;
 const playerIds=links.data.map(p=>p.player_id);
 const playerResult=playerIds.length?await supabase.from("players").select("id,display_name").in("id",playerIds).order("display_name").returns<PlayerOption[]>():{data:[] as PlayerOption[],error:null};
 if(playerResult.error) throw new Error("Unable to load the player list.");
 const players=playerResult.data!;
 const available=players.filter(p=>!roster.data.some(r=>r.player_id===p.id));
 const sorted=[...roster.data].sort((a,b)=>a.status.localeCompare(b.status)||(a.jersey_number??100)-(b.jersey_number??100));
 const active=roster.data.filter(r=>r.status==="active").length;
 return <><div className="page-heading"><div><p className="eyebrow">{division.data.name} · TEAM ROSTER</p><h1>{team.data.name}</h1><p>{active} active / {settings.data?.roster_limit??"not configured"} maximum · {roster.data.length-active} inactive</p></div><Link className="button" href="/teams">All teams</Link></div>
 <p className="notice">Roster membership alone does not confirm registration, waivers, payments, or game eligibility.</p>
 {!settings.data&&<p><Link className="text-link" href={"/league/settings?season="+division.data.season_id}>Set the season roster limit before activating players →</Link></p>}
 <div className="roster-create"><PlayerForm/><RosterForm key={available.map(p=>p.id).join(",")} entryId={entryId} players={available}/></div>
 <div className="section-heading"><h2>Players</h2><span>Deactivate players to retain their history</span></div>
 {sorted.length?<div className="roster-list">{sorted.map(row=><RosterForm key={row.id+":"+row.revision} entryId={entryId} players={players} row={row}/>)}</div>:<section className="panel empty"><h2>Your roster is empty.</h2><p>Create a player profile or select an existing player to get started.</p></section>}
 </>;
}

