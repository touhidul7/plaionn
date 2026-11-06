import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredKeys = [
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_ANON_KEY,
].filter(Boolean);
function isPublicSupabaseKey(value) {
  if (value.startsWith("sb_publishable_")) return true;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.role === "anon";
  } catch {
    return false;
  }
}
const key = configuredKeys.find(isPublicSupabaseKey);
if (!url || !key) {
  if (configuredKeys.length) {
    console.error("No valid Supabase public key found. Use an sb_publishable_ key or legacy anon JWT (role=anon).");
    process.exit(1);
  }
  console.error("Configure the project URL and publishable or anon key in .env.local.");
  process.exit(1);
}
const privateTables = [
  "leagues",
  "league_memberships",
  "seasons",
  "divisions",
  "teams",
  "team_entries",
  "season_settings",
  "season_settings_audit",
  "players",
  "league_players",
  "roster_memberships",
  "roster_audit",
  "venues",
  "rinks",
  "games",
  "schedule_audit",
  "game_officials",
  "official_assignment_audit",
  "player_registrations",
  "registration_audit",
  "game_events",
  "game_event_voids",
];
try {
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) throw new Error("Invalid URL");
  const authResponse = await fetch(new URL("/auth/v1/settings", endpoint), {
    headers: { apikey: key }, signal: AbortSignal.timeout(15000),
  });
  console.log("Auth: HTTP " + authResponse.status);
  if (!authResponse.ok) {
    process.exitCode = 1;
    await authResponse.body?.cancel();
  } else await authResponse.body?.cancel();

  let verifiedTables = 0;
  for (const table of privateTables) {
    const response = await fetch(new URL("/rest/v1/" + table + "?select=*&limit=0", endpoint), {
      headers: { apikey: key }, signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      const failure = await response.json().catch(() => ({}));
      const message = String(failure.message ?? "").toLowerCase();
      if (message === "permission denied for table " + table) {
        verifiedTables++;
      } else {
        process.exitCode = 1;
        console.error(table + ": HTTP 401; " + (message.includes("api key") || message.includes("apikey") ? "public API key rejected." : "unexpected authorization failure."));
      }
    } else if (response.ok) {
      process.exitCode = 1;
      await response.body?.cancel();
      console.error(table + ": anonymous table access is enabled; expected private access denied.");
    } else {
      process.exitCode = 1;
      const failure = await response.json().catch(() => ({}));
      const code = typeof failure.code === "string" && /^[A-Z0-9_]{1,30}$/.test(failure.code) ? " (" + failure.code + ")" : "";
      console.error(table + ": HTTP " + response.status + code + "; expected the table to exist and deny anonymous access.");
    }
  }
  console.log("Private schema: " + verifiedTables + "/" + privateTables.length + " tables exist and deny anonymous access.");
} catch {
  console.error("Supabase connection check failed. Check project URL, connectivity, and project status. Credentials were not logged.");
  process.exitCode = 1;
}
