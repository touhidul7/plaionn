import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type");
  const isPasswordSetup = type === "recovery" || type === "invite";
  const next = request.nextUrl.searchParams.get("next") || (isPasswordSetup ? "/reset-password" : "/account");

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        if (isPasswordSetup) {
          return NextResponse.redirect(new URL("/reset-password", request.url));
        }
        const destination = new URL(next, request.url);
        return NextResponse.redirect(destination.origin === request.nextUrl.origin ? destination : new URL("/account", request.url));
      }
    } catch {
      /* Show a generic error; never expose tokens or provider details. */
    }
  }
  if (isPasswordSetup) {
    return NextResponse.redirect(new URL("/reset-password?error=confirmation", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}

