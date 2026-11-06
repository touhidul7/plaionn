import Link from "next/link";
import { getVerifiedSession } from "@/lib/supabase/session";
import { selectLeague,signOut } from "@/app/login/actions";
export const dynamic="force-dynamic";
export default async function AccountPage() {
 const {supabase,user}=await getVerifiedSession();
 const {data:memberships,error}=await supabase.from("league_memberships").select("league_id,role").eq("user_id",user.id);
 const ids=[...new Set((memberships??[]).map(m=>m.league_id))];
 const result=ids.length?await supabase.from("leagues").select("id,name").in("id",ids):{data:[],error:null};
 return <><div className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Welcome to PLAIONN.</h1><p>{user.email}</p></div><form action={signOut}><button>Sign out</button></form></div><section className="panel"><h2>Your leagues</h2><p><Link className="text-link" href="/registration">Apply for a season</Link></p>{memberships?.some(m=>m.role==="commissioner")&&<p><Link className="text-link" href="/league/registrations">Review league registrations</Link></p>}{error||result.error?<p role="alert">The league database is not available yet. Your administrator needs to complete Supabase setup before you can continue.</p>:!ids.length?<><p>Your account is ready. Apply for an open season, or ask your league administrator to assign your membership.</p><p>Account ID: <code>{user.id}</code></p></>:result.data?.map(league=><form action={selectLeague} className="list-row" key={league.id}><input type="hidden" name="leagueId" value={league.id}/><h2>{league.name}</h2><p>{memberships?.filter(m=>m.league_id===league.id).map(m=>m.role).join(" · ")}</p><button className="primary">Open league →</button></form>)}</section></>;
}

