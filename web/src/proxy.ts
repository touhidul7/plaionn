import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request:NextRequest) {
 let response=NextResponse.next({request});
 const {url,key}=getSupabaseConfig();
 const supabase=createServerClient(url,key,{
  cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll(items){
    items.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   },
  },
 });
 // Refresh cookies here; page/action authorization independently verifies the user.
 try { await supabase.auth.getUser(); } catch { /* Routes present a safe sign-in/setup state. */ }
 response.headers.set("Cache-Control","private, no-store");
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};

