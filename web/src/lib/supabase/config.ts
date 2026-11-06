export function isPublicSupabaseKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configuredKeys = [
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_ANON_KEY,
  ].filter((value): value is string => Boolean(value));
  const key = configuredKeys.find(isPublicSupabaseKey);
  if (!url || !key) {
    if (configuredKeys.length) throw new Error("Use a Supabase publishable key or legacy anon key. Secret/service-role keys are not allowed.");
    throw new Error("Supabase URL and a publishable or anon key must be configured.");
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Supabase URL is invalid."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Use the HTTPS Supabase project URL without credentials, query parameters, or paths.");
  }
  if (!isPublicSupabaseKey(key)) {
    throw new Error("Use a Supabase publishable key or legacy anon key. Secret/service-role keys are not allowed.");
  }
  return { url: parsed.origin, key };
}
