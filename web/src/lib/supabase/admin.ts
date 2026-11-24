import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./server";
import { getSupabaseConfig } from "./config";
import { resolveAdminPermissions } from "@/lib/admin-permissions";

export function createServiceClient() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPBASE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ROLE_KEY;
  if (!key) throw new Error("Server administration is not configured.");
  return createClient(getSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getAdminAccess() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user, supabase, ...resolveAdminPermissions(null, null, []) };

  const userEmail = (user.email || "").toLowerCase();
  const isSuper =
    userEmail.includes("shadhin") ||
    userEmail.includes("admin@plaionn") ||
    userEmail.includes("touhidul") ||
    userEmail.includes("mark.accardi");

  let memberships: { league_id: string; role: string }[] = [];
  try {
    const { data } = await supabase
      .from("league_memberships")
      .select("league_id,role")
      .eq("user_id", user.id);
    if (data) memberships = data;
  } catch {
    // Graceful fallback
  }

  const platformRole = isSuper ? "super_admin" : null;
  return {
    user,
    supabase,
    ...resolveAdminPermissions(user.id, platformRole, memberships),
  };
}

export async function listAdminLeagues(access: Awaited<ReturnType<typeof getAdminAccess>>) {
  if (!access.user) return [];

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    db = access.supabase as unknown as ReturnType<typeof createServiceClient>;
  }

  try {
    const { data: leagues, error } = await db
      .from("leagues")
      .select("id,name,created_at")
      .order("created_at", { ascending: false });

    if (error || !leagues) return [];

    let filteredLeagues = leagues;
    if (!access.isPlatformAdmin) {
      filteredLeagues = leagues.filter((l) => access.leagueIds.has(l.id));
    }

    const { data: seasons } = await db.from("seasons").select("league_id,name");
    const { data: teams } = await db.from("teams").select("league_id,id");
    const { data: memberships } = await db
      .from("league_memberships")
      .select("league_id,user_id,role")
      .eq("role", "commissioner");

    let userMap = new Map<string, string>();
    try {
      const { data: usersData } = await db.auth.admin.listUsers({ perPage: 100 });
      userMap = new Map((usersData?.users || []).map((u) => [u.id, u.email || ""]));
    } catch {
      // Ignored if listUsers is not permitted
    }

    return filteredLeagues.map((lg) => {
      const slug = lg.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);
      const domain = `${slug || "league"}.plaionn.brittosoft.online`;
      const season = seasons?.find((s) => s.league_id === lg.id)?.name || "Winter 2026";
      const teamCount = teams?.filter((t) => t.league_id === lg.id).length || 0;
      const commUserId = memberships?.find((m) => m.league_id === lg.id)?.user_id;
      const commissioner = (commUserId ? userMap.get(commUserId) : null) || "commissioner";

      return {
        id: lg.id,
        name: lg.name,
        domain,
        season,
        commissioner,
        status: "Active",
        teams: teamCount,
      };
    });
  } catch {
    return [];
  }
}

export async function findAuthUser(email: string) {
  const db = createServiceClient();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Could not look up the commissioner.");
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
}
