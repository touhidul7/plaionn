import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";

export const getVerifiedSession = cache(async () => {
 const supabase = await createSupabaseServerClient(false);
 const {data, error} = await supabase.auth.getUser();
 if (error || !data.user) redirect("/login");
 return {supabase, user:data.user};
});
export const getLeagueContext = cache(async () => {
 const {supabase,user}=await getVerifiedSession();
 const {data:memberships,error}=await supabase.from("league_memberships").select("league_id,role").eq("user_id",user.id);
 if(error) redirect("/account?state=database");
 if(!memberships?.length) redirect("/account?state=membership");
 const selected=(await cookies()).get("plaionn-league")?.value;
 const membership=memberships.find(m=>m.league_id===selected) ?? [...memberships].sort((a,b)=>a.league_id.localeCompare(b.league_id))[0];
 const {data:league,error:leagueError}=await supabase.from("leagues").select("id,name").eq("id",membership.league_id).single();
 if(leagueError || !league) redirect("/account?state=database");
 return {supabase,user,league,canManage:memberships.some(m=>m.league_id===league.id && m.role==="commissioner")};
});

