import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./server";
import { getSupabaseConfig } from "./config";
import { resolveAdminPermissions } from "@/lib/admin-permissions";

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("Server administration is not configured.");
  return createClient(getSupabaseConfig().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getAdminAccess() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user, supabase, ...resolveAdminPermissions(null, null, []) };
  const [platform, memberships] = await Promise.all([
    supabase.from("platform_administrators").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("league_memberships").select("league_id,role").eq("user_id", user.id),
  ]);
  if (platform.error || memberships.error) throw new Error("Could not verify admin permissions. Check the database migrations.");
  return { user, supabase, ...resolveAdminPermissions(user.id, platform.data?.role ?? null, memberships.data ?? []) };
}

export async function listAdminLeagues(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (!access.user || (!access.isPlatformAdmin && !access.leagueIds.size)) return [];
  let db: ReturnType<typeof createServiceClient> | typeof access.supabase;
  try {
    db = access.isPlatformAdmin ? createServiceClient() : access.supabase;
  } catch {
    // Service role key not configured — fall back to the user's own client for platform admins.
    db = access.supabase;
  }
  let query = db.from("leagues").select("id,name,admin_league_settings(domain,season,commissioner_email),teams(count)");
  if (!access.isPlatformAdmin) query = query.in("id", [...access.leagueIds]);
  const { data, error } = await query.order("name");
  if (error) throw new Error("Could not load assigned leagues.");
  return (data ?? []).map(row => {
    const settings = (Array.isArray(row.admin_league_settings) ? row.admin_league_settings[0] : row.admin_league_settings) as {domain: string; season: string; commissioner_email: string} | null;
    return { id: row.id, name: row.name, domain: settings?.domain ?? "", season: settings?.season ?? "Not configured", commissioner: settings?.commissioner_email ?? "", status: "Active", teams: row.teams?.[0]?.count ?? 0 };
  });
}

export async function findAuthUser(email: string) {
  const db = createServiceClient();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Could not look up the commissioner.");
    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
}
