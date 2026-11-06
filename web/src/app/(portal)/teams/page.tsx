import Link from "next/link";
import { getLeagueData } from "@/lib/league";
export const dynamic = "force-dynamic";
export default async function TeamsPage() {
 const {teams,canManage}=await getLeagueData();
 return <><div className="page-heading"><div><p className="eyebrow">THE CLUBS</p><h1>Your teams.</h1><p>One league. A new season of possibilities.</p></div><Link className="button primary" href="/league">Add a team ↗</Link></div><section className="panel">{teams.length?<div className="table-wrap"><table className="table"><caption className="eyebrow">League team entries</caption><thead><tr><th scope="col">Team</th><th scope="col">Season</th><th scope="col">Division</th><th scope="col">Roster</th></tr></thead><tbody>{teams.map(t=><tr key={t.entry_id}><td><strong>{t.name}</strong></td><td>{t.season_name}</td><td>{t.division_name}</td><td>{canManage?<Link className="button" href={"/teams/"+t.entry_id} aria-label={"Manage roster for "+t.name}>Manage roster ?</Link>:"Commissioner access"}</td></tr>)}</tbody></table></div>:<div className="empty"><h2>The ice is waiting.</h2><p>Create a season and division, then add your first team in League HQ. Then open the team to manage its roster.</p><Link className="button" href="/league">Open League HQ →</Link></div>}</section></>;
}
