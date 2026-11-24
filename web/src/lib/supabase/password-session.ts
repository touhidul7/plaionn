import type { SupabaseClient } from "@supabase/supabase-js";

export const PASSWORD_LINK_ERROR =
  "This password link is invalid, expired, or already used. Request a new reset link from the login page and open the latest email.";

// Invites and dashboard recovery emails use fragment tokens, even though
// @supabase/ssr uses PKCE for flows initiated by this app.
export async function establishPasswordSession(
  auth: SupabaseClient["auth"],
  href: string,
): Promise<void> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has("error") || hash.has("error_code") || url.searchParams.has("error")) {
    throw new Error(PASSWORD_LINK_ERROR);
  }

  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (access_token && refresh_token) {
    const { data, error } = await auth.setSession({ access_token, refresh_token });
    if (error || !data.session) throw new Error(PASSWORD_LINK_ERROR);
    return;
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await auth.exchangeCodeForSession(code);
    if (error || !data.session) throw new Error(PASSWORD_LINK_ERROR);
    return;
  }

  // getSession checks existing cookie/memory session
  const { data, error } = await auth.getSession();
  if (error || !data.session) throw new Error(PASSWORD_LINK_ERROR);
}
