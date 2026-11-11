"use server";
import {cookies} from "next/headers";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {getVerifiedSession} from "@/lib/supabase/session";

export type CreateLeagueState={error:boolean;message:string};
const leagueNameSchema=z.object({name:z.string().trim().min(2).max(100)});

export async function createLeague(_previous:CreateLeagueState,form:FormData):Promise<CreateLeagueState>{
 const parsed=leagueNameSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Enter a league name between 2 and 100 characters."};
 const {supabase}=await getVerifiedSession();
 let result;
 try{
  result=await supabase.rpc("create_league",{league_name:parsed.data.name});
 }catch{
  return {error:true,message:"Could not reach Supabase. No league was created. Please try again."};
 }
 if(result.error){
  if(result.error.code==="42501") return {error:true,message:"Only an existing league commissioner can create another league."};
  if(result.error.code==="22023") return {error:true,message:"Enter a league name between 2 and 100 characters."};
  return {error:true,message:"League setup is unavailable. Confirm the league-provisioning migration is applied."};
 }
 const leagueId=z.uuid().safeParse(result.data);
 if(!leagueId.success) return {error:true,message:"Supabase returned an invalid league identifier. Contact support."};
 (await cookies()).set("plaionn-league",leagueId.data,{
  httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30,
 });
 revalidatePath("/","layout");
 revalidatePath("/account");
 redirect("/");
}
