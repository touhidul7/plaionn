import Link from "next/link";
import {getVerifiedSession} from "@/lib/supabase/session";
import {RegistrationForm,RegistrationDecision} from "@/components/registration-forms";
import {openSeasonsSchema} from "@/lib/registration-schema";
export const dynamic="force-dynamic";
export default async function RegistrationPage(){
 const {supabase,user}=await getVerifiedSession();
 const [available,profile,requests]=await Promise.all([
  supabase.rpc("open_registration_seasons"),
  supabase.from("players").select("display_name").eq("owner_user_id",user.id).maybeSingle(),
  supabase.from("player_registrations").select("id,season_id,season_name,league_name,status,position,revision,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
 ]);
 const seasons=openSeasonsSchema.safeParse(available.data);
 if(available.error||profile.error||requests.error||!seasons.success) return <section className="panel"><h1>Registration unavailable</h1><p>Please try again after registration setup is complete.</p></section>;
 // Request IDs are owner-filtered; RLS also protects review notes.
 const decisions=requests.data.length?await supabase.from("registration_audit").select("id,registration_id,changed_at,new_status,reason").in("registration_id",requests.data.map(r=>r.id)).order("changed_at",{ascending:false}):{data:[],error:null};
 return <><div className="page-heading"><div><p className="eyebrow">JOIN THE ICE</p><h1>Player registration</h1><p>Apply to an open season and follow your application here.</p></div><Link className="button" href="/account">My leagues</Link></div>
 {!seasons.data.length&&<p>No seasons are accepting applications right now.</p>}
 <RegistrationForm seasons={seasons.data.filter(s=>!requests.data.some(r=>r.season_id===s.season_id))} name={profile.data?.display_name}/>
 <h2>Your applications</h2>{!requests.data.length&&<p>No applications yet.</p>}{requests.data.map(r=><section className="panel" key={r.id}><h3>{r.league_name} · {r.season_name}</h3><p><span className="badge">{r.status.toUpperCase()}</span> · Position: {r.position}</p>{r.status==="pending"&&<RegistrationDecision id={r.id} revision={r.revision}/>}{r.status==="approved"&&<p>Your league is available in My account. Team placement and eligibility are managed separately.</p>}{decisions.error?<p>Review history could not be loaded.</p>:<ul>{decisions.data?.filter(d=>d.registration_id===r.id).map(d=><li key={d.id}>{d.new_status}: {d.reason}</li>)}</ul>}</section>)}</>;
}
