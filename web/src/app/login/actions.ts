"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVerifiedSession } from "@/lib/supabase/session";
import { appOrigin } from "@/lib/app-origin";

export type AuthState={error:boolean;message:string};
const credentials=z.object({email:z.email().max(254),password:z.string().min(8).max(128),mode:z.enum(["login","signup"])});
export async function authenticate(_state:AuthState,form:FormData):Promise<AuthState> {
 const input=credentials.safeParse(Object.fromEntries(form));
 if(!input.success) return {error:true,message:"Enter a valid email and a password between 8 and 128 characters."};
 const {email,password,mode}=input.data;
 let signedIn=false;
 try {
  const supabase=await createSupabaseServerClient();
  if(mode==="signup") {
   const siteUrl=appOrigin(process.env.NEXT_PUBLIC_APP_URL,process.env.NODE_ENV==="production");
   const result=await supabase.auth.signUp({email,password,options:{emailRedirectTo:new URL("/auth/callback",siteUrl).href}});
   if(result.error) return {error:true,message:result.error.status===429?"Too many attempts. Please wait before trying again.":"Account creation could not be completed. Check the Supabase configuration or try again later."};
   signedIn=!!result.data.session;
   if(!signedIn) return {error:false,message:"If registration is available for this email, a confirmation message will arrive. Follow it in this browser, then sign in."};
  } else {
   const result=await supabase.auth.signInWithPassword({email,password});
   if(result.error) return {error:true,message:result.error.status===429?"Too many attempts. Please wait before trying again.":"Sign-in failed. Check your email/password and email confirmation. The project connection must also be configured."};
   signedIn=!!result.data.session;
  }
 } catch { return {error:true,message:"The sign-in service is unavailable. Please try again later."}; }
 if(signedIn) { revalidatePath("/","layout"); redirect("/account"); }
 return {error:true,message:"Could not establish a session."};
}
export async function signOut():Promise<void> {
 const supabase=await createSupabaseServerClient();
 await supabase.auth.signOut({scope:"local"});
 (await cookies()).delete("plaionn-league");
 revalidatePath("/","layout");
 redirect("/login");
}
export async function selectLeague(form:FormData):Promise<void> {
 const id=z.uuid().safeParse(form.get("leagueId"));
 if(!id.success) redirect("/account");
 const {supabase,user}=await getVerifiedSession();
 const {data,error}=await supabase.from("league_memberships").select("league_id").eq("user_id",user.id).eq("league_id",id.data).limit(1);
 if(error||!data?.length) redirect("/account?state=membership");
 (await cookies()).set("plaionn-league",id.data,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});
 revalidatePath("/","layout");
 redirect("/");
}

