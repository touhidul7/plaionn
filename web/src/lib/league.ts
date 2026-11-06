import "server-only";
import { getLeagueContext } from "./supabase/session";
export type NamedRecord={id:string;name:string};
export type Division=NamedRecord & {season_id:string;season_name:string};
export type TeamEntry=NamedRecord & {entry_id:string;division_name:string;season_name:string};
export async function getLeagueData() {
 const {supabase,league,canManage}=await getLeagueContext();
 const [seasons,divisions,teams,entries]=await Promise.all([
  supabase.from("seasons").select("id,name").eq("league_id",league.id).order("name").returns<NamedRecord[]>(),
  supabase.from("divisions").select("id,name,season_id").eq("league_id",league.id).order("name").returns<(NamedRecord&{season_id:string})[]>(),
  supabase.from("teams").select("id,name").eq("league_id",league.id).order("name").returns<NamedRecord[]>(),
  supabase.from("team_entries").select("id,team_id,division_id").eq("league_id",league.id).returns<{id:string;team_id:string;division_id:string}[]>(),
 ]);
 if([seasons,divisions,teams,entries].some(result=>result.error)) throw new Error("Could not load league records from Supabase.");
 const seasonMap=new Map(seasons.data!.map(s=>[s.id,s]));
 const divisionRows:Division[]=divisions.data!.map(d=>({...d,season_name:seasonMap.get(d.season_id)?.name??"Unavailable season"}));
 const divisionMap=new Map(divisionRows.map(d=>[d.id,d]));
 const teamMap=new Map(teams.data!.map(t=>[t.id,t]));
 const teamRows:TeamEntry[]=entries.data!.map(entry=>{
  const team=teamMap.get(entry.team_id);
  const division=divisionMap.get(entry.division_id);
  if(!team||!division) throw new Error("The league contains an incomplete team entry.");
  return {...team,entry_id:entry.id,division_name:division.name,season_name:division.season_name};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 return {seasons:seasons.data!,divisions:divisionRows,teams:teamRows,league,canManage};
}

