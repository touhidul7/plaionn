import Link from "next/link";
import {getLeagueContext} from "@/lib/supabase/session";
import {RegistrationDecision,RegistrationPublication} from "@/components/registration-forms";
export const dynamic="force-dynamic";
export default async function ReviewRegistrations(){
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return <section className="panel"><h1>Commissioner access required</h1></section>;
 const [seasons,settings,requests]=await Promise.all([
  supabase.from("seasons").select("id,name").eq("league_id",league.id),
  supabase.from("season_settings").select("season_id,revision,registration_enabled,registration_opens,registration_closes").eq("league_id",league.id),
  supabase.from("player_registrations").select("id,season_id,player_id,status,position,revision,created_at").eq("league_id",league.id).order("created_at",{ascending:false}),
 ]);
 if(seasons.error||settings.error||requests.error) return <section className="panel"><h1>Registration unavailable</h1><p>Please complete registration database setup and try again.</p></section>;
 const profiles=requests.data.length?await supabase.from("players").select("id,display_name").in("id",requests.data.map(r=>r.player_id)):{data:[],error:null};
 if(profiles.error) return <section className="panel"><h1>Applicants could not be loaded</h1><p>Please reload and try again.</p></section>;
 return <><div className="page-heading"><div><p className="eyebrow">LEAGUE REGISTRATION</p><h1>Welcome your players.</h1><p>{league.name}</p></div><Link className="button" href="/league/settings">Season settings</Link></div>
 <section className="panel"><h2>Registration windows</h2><p>Set opening and closing dates in Season settings, then publish. Dates are inclusive and use UTC. Published seasons are discoverable by signed-in applicants.</p>{seasons.data.map(season=>{
 const config=settings.data.find(s=>s.season_id===season.id);
 return <div className="list-row" key={season.id}><h3>{season.name}</h3>{config?<><p>{config.registration_opens??"Opening date unset"} – {config.registration_closes??"Closing date unset"} · {config.registration_enabled?"Published":"Closed"}</p><RegistrationPublication seasonId={season.id} revision={config.revision} enabled={config.registration_enabled}/></>:<p>Save this season’s settings first.</p>}</div>;
 })}</section><h2>Applications</h2><p>Approval adds a player membership to this league. Assign teams through roster management; payment, documents, and game eligibility are separate.</p>
 {!requests.data.length&&<p>No applications yet.</p>}{requests.data.map(r=><section className="panel" key={r.id}><h3>{profiles.data?.find(p=>p.id===r.player_id)?.display_name??"Player"} <small>({r.player_id.slice(0,8)})</small></h3><p>{seasons.data.find(s=>s.id===r.season_id)?.name} · {r.position} · {r.status.toUpperCase()}</p>{r.status==="pending"&&<RegistrationDecision id={r.id} revision={r.revision} review/>}</section>)}</>;
}
