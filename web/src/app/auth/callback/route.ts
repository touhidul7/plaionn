import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
export async function GET(request:NextRequest) {
 const code=request.nextUrl.searchParams.get("code");
 if(code) {
  try {
   const supabase=await createSupabaseServerClient();
   const {error}=await supabase.auth.exchangeCodeForSession(code);
   if(!error) return NextResponse.redirect(new URL("/account",request.url));
  } catch { /* Show a generic error; never expose tokens or provider details. */ }
 }
 return NextResponse.redirect(new URL("/login?error=confirmation",request.url));
}

