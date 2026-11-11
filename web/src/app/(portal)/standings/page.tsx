import Link from "next/link";
import {z} from "zod";
import {getLeagueData} from "@/lib/league";
import {getLeagueContext} from "@/lib/supabase/session";
export const dynamic="force-dynamic";

const standingsRowSchema=z.object({
 division_id:z.uuid(),division_name:z.string(),team_entry_id:z.uuid(),team_name:z.string(),rank:z.number(),
 games_played:z.number(),wins:z.number(),ties:z.number(),losses:z.number(),overtime_losses:z.number(),
 goals_for:z.number(),goals_against:z.number(),goal_difference:z.number(),penalty_minutes:z.number(),
 points:z.number(),head_to_head_points:z.number(),
});

export default async function StandingsPage({searchParams}:{searchParams:Promise<{season?:string}>}){
 const [{season:requestedSeason},data]=await Promise.all([searchParams,getLeagueData()]);
 const selectedSeason=data.seasons.find(season=>season.id===requestedSeason)??data.seasons[0];
 if(!selectedSeason) return <><div className="page-heading"><div><p className="eyebrow">OFFICIAL TABLE</p><h1>Standings</h1><p>{data.league.name}</p></div><Link className="button" href="/league">League setup</Link></div><section className="panel empty"><h2>No season to rank yet.</h2><p>Create a season, divisions, and teams in League HQ to start the table.</p></section></>;
 const {supabase}=await getLeagueContext();
 const {data:rawRows,error}=await supabase.rpc("get_season_standings",{target_season:selectedSeason.id});
 const parsedRows=z.array(standingsRowSchema).safeParse(rawRows);
 const rows=parsedRows.success?parsedRows.data:null;
 return <><div className="page-heading"><div><p className="eyebrow">OFFICIAL TABLE</p><h1>Standings</h1><p>{data.league.name} · Approved results only</p></div><Link className="button" href="/schedule">Schedule</Link></div>
 <section className="panel form-stack"><form action="/standings" method="get" className="settings-grid"><label>Season<select name="season" defaultValue={selectedSeason.id}>{data.seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label><button className="primary">View standings</button></form>
 {error||!rows?<div className="notice" role="status"><h2>Official standings unavailable</h2><p>{error?.code==="PGRST202"||error?.code==="42883"?"Apply the game-results and standings migration before viewing official standings.":"Could not calculate standings from the connected database. Check the migration and league access."}</p></div>:
  rows?.length?data.divisions.filter(division=>division.season_id===selectedSeason.id).map(division=>{
   const divisionRows=rows.filter(row=>row.division_id===division.id);
   return <section key={division.id}><div className="section-heading"><h2>{division.name}</h2></div>{divisionRows.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">GP</th><th scope="col">W</th><th scope="col">T</th><th scope="col">L</th><th scope="col">OTL</th><th scope="col">GF</th><th scope="col">GA</th><th scope="col">GD</th><th scope="col">PIM</th><th scope="col">PTS</th></tr></thead><tbody>{divisionRows.map(row=><tr key={row.team_entry_id}><td>{row.rank}</td><td><strong>{row.team_name}</strong></td><td>{row.games_played}</td><td>{row.wins}</td><td>{row.ties}</td><td>{row.losses}</td><td>{row.overtime_losses}</td><td>{row.goals_for}</td><td>{row.goals_against}</td><td>{row.goal_difference>0?"+":""}{row.goal_difference}</td><td>{row.penalty_minutes}</td><td><strong>{row.points}</strong></td></tr>)}</tbody></table></div>:<p className="empty">No teams in this division yet.</p>}</section>;
  }):<section className="empty"><h2>No divisions for {selectedSeason.name}.</h2><p>Add divisions and teams in League HQ to begin tracking standings.</p></section>}
 <p className="field-help">Only independently approved results count. Points and tiebreaker order use the season settings. Pending, corrected, and unreviewed scores are excluded.</p>
 </section></>;
}
