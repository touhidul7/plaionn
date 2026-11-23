"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVerifiedSession } from "@/lib/supabase/session";
import { appOrigin } from "@/lib/app-origin";

export type AuthState={error:boolean;message:string};
const credentials=z.object({
  fullName:z.string().max(100).optional(),
  email:z.string().email().max(254),
  password:z.string().min(8).max(128).optional(),
  mode:z.enum(["login","signup","forgot"])
});
export async function authenticate(_state:AuthState,form:FormData):Promise<AuthState> {
 const input=credentials.safeParse(Object.fromEntries(form));
 if(!input.success) return {error:true,message:"Enter a valid email address."};
 const {fullName,email,password,mode}=input.data;

 if(mode==="forgot") {
  try {
   const supabase=await createSupabaseServerClient(false);
   const siteUrl=appOrigin(process.env.NEXT_PUBLIC_APP_URL,process.env.NODE_ENV==="production");
   const redirectTo=new URL("/auth/callback",siteUrl).href;
   const result=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
   if(result.error) {
    return {
     error:true,
     message:result.error.status===429
      ?"Too many reset requests. Please wait before trying again."
      :result.error.message||"Could not send reset link."
    };
   }
   return {
    error:false,
    message:"✓ Reset link sent! Please check your email inbox to reset your password."
   };
  } catch {
   return {error:true,message:"The reset service is unavailable. Please try again later."};
  }
 }

 if(mode==="signup" && (!fullName || fullName.trim().length === 0)) {
  return {error:true,message:"Please enter your full name."};
 }

 if(!password||password.length<8) {
  return {error:true,message:"Password must be at least 8 characters."};
 }

 let signedIn=false;
 try {
  const supabase=await createSupabaseServerClient();
  if(mode==="signup") {
   const siteUrl=appOrigin(process.env.NEXT_PUBLIC_APP_URL,process.env.NODE_ENV==="production");
   const displayName = (fullName || "").trim();
   const result=await supabase.auth.signUp({
     email,
     password,
     options:{
       emailRedirectTo:new URL("/auth/callback",siteUrl).href,
       data: {
         display_name: displayName,
         full_name: displayName,
         role: "Player",
       }
     }
   });
   if(result.error) return {error:true,message:result.error.status===429?"Too many attempts. Please wait before trying again.":"Could not create your account. If you already have an account, try signing in."};
   signedIn=!!result.data.session;
   // Confirm Email is disabled for this deployment. Supabase should return a
   // session immediately; never treat a user record alone as authenticated.
   if(!signedIn) return {error:true,message:"We could not sign you in automatically. Try signing in with your email and password. If that fails, contact your league administrator."};
  } else {
   const result=await supabase.auth.signInWithPassword({email,password});
   if(result.error) return {error:true,message:result.error.status===429?"Too many attempts. Please wait before trying again.":"Sign-in failed. Check your email and password, or contact your league administrator."};
   signedIn=!!result.data.session;
  }
 } catch { return {error:true,message:"The sign-in service is unavailable. Please try again later."}; }
 if(signedIn) { revalidatePath("/","layout"); redirect("/admin"); }
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
 redirect(`/admin/league/${id.data}`);
}

