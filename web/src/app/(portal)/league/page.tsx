import Link from "next/link";
import {getLeagueData} from "@/lib/league";
import {SetupForm} from "@/components/setup-form";
export const dynamic="force-dynamic";
export default async function LeaguePage(){
 const data=await getLeagueData();
 return <><div className="page-heading"><div><p className="eyebrow">LEAGUE OPERATIONS</p><h1>Make it your season.</h1><p>{data.league.name}</p></div><Link href="/league/settings" className="button primary">Season settings</Link></div>{data.canManage&&<p><Link className="button" href="/league/registrations">Manage registration</Link></p>}{data.canManage?<div className="cards"><SetupForm kind="season" title="1. Start a season"/><SetupForm kind="division" title="2. Add a division" parentLabel="Season" parents={data.seasons}/><SetupForm kind="team" title="3. Add a team" parentLabel="Division" parents={data.divisions.map(d=>({id:d.id,name:d.season_name+" · "+d.name}))}/></div>:<p>Your league commissioner manages seasons, divisions, and teams.</p>}<div className="section-heading"><h2>Your competition structure</h2></div><section className="panel">{data.seasons.length?data.seasons.map(season=><div className="list-row" key={season.id}><strong>{season.name}</strong><p>{data.divisions.filter(d=>d.season_id===season.id).map(d=>d.name).join(" · ")||"No divisions yet"}</p></div>):<div className="empty"><h2>Your first season starts here.</h2><p>There are no seasons in this league yet.</p></div>}</section></>;
}

