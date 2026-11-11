import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {LiveScoreboard} from "@/components/live-scoreboard";
import {getLeagueData} from "@/lib/league";
import {liveScoreboardSchema} from "@/lib/live-scoreboard";
import {getLeagueContext} from "@/lib/supabase/session";

export const dynamic="force-dynamic";

export default async function LiveGamePage({params}:{params:Promise<{gameId:string}>}){
 const {gameId}=await params;
 if(!z.uuid().safeParse(gameId).success) notFound();
 const {supabase,league}=await getLeagueContext();
 const game=await supabase.from("games").select("id,status,home_entry_id,away_entry_id").eq("id",gameId).eq("league_id",league.id).eq("status","scheduled").maybeSingle();
 if(game.error) return <section className="panel"><h1>Live scoreboard unavailable</h1><p>Could not load this scheduled game.</p></section>;
 if(!game.data) notFound();
 const fixture=game.data;
 const {data,error}=await supabase.rpc("get_live_scoreboard",{target_game:gameId});
 const board=liveScoreboardSchema.safeParse(data);
 if(error||!board.success) return <section className="panel"><h1>Live scoreboard unavailable</h1><p>Apply the live-score migration and try again.</p><Link className="button" href="/schedule">Back to schedule</Link></section>;
 const leagueData=await getLeagueData();
 const homeName=leagueData.teams.find(team=>team.entry_id===fixture.home_entry_id)?.name??"Home";
 const awayName=leagueData.teams.find(team=>team.entry_id===fixture.away_entry_id)?.name??"Away";
 return <><div className="page-heading"><div><p className="eyebrow">{league.name}</p><h1>Live scoreboard</h1><p>For league members · Automatically refreshed from saved game events.</p></div><Link className="button" href="/schedule">Schedule</Link></div>
  <LiveScoreboard initial={board.data} homeName={homeName} awayName={awayName}/>
 </>;
}
