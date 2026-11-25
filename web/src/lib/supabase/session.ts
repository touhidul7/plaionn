import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";
import { sanitizeLeagueName, sanitizeSeasonName } from "@/lib/sanitize";

export const DOMAIN_LEAGUE_MAP: Record<string, string> = {
  // Main Platform Root Domains
  "plaionn.brittosoft.online": "platform",
  "www.plaionn.brittosoft.online": "platform",
  "plaionn.vercel.app": "platform",
  "plaionn.com": "platform",
  "www.plaionn.com": "platform",

  // Test & Client domains: *.plaionn.brittosoft.online
  "ontariocen.plaionn.brittosoft.online": "71a624e7-3152-49ac-9f3c-397c95c466d3",
  "ontariocentral.plaionn.brittosoft.online": "71a624e7-3152-49ac-9f3c-397c95c466d3",
  "ontarionat.plaionn.brittosoft.online": "8768117b-482b-457c-96e4-3171209af6c0",
  "torontomet.plaionn.brittosoft.online": "3fccda71-0263-479d-be59-27ab40fe51fd",
  "league1.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000001",
  "bhl.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000001",
  "league2.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000003",
  "wahl.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000003",
  "league3.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000004",
  "chl.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000004",
  "league4.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000005",
  "ihl.plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000005",

  // Production Client Domains
  "league1.dealioadvisors.com": "60000000-0000-4000-8000-000000000001",
  "bhl.com": "60000000-0000-4000-8000-000000000001",
  "league2.dealioadvisors.com": "60000000-0000-4000-8000-000000000003",
  "waveadulthockeyleague.ca": "60000000-0000-4000-8000-000000000003",
  "league3.dealioadvisors.com": "60000000-0000-4000-8000-000000000004",
  "chl.com": "60000000-0000-4000-8000-000000000004",
  "league4.dealioadvisors.com": "60000000-0000-4000-8000-000000000005",
  "ihl.com": "60000000-0000-4000-8000-000000000005",
};

export interface PublicLeagueOverview {
  league_id: string;
  league_name: string;
  seasons: { id: string; name: string }[];
  divisions: { id: string; name: string; season_id: string }[];
  teams: {
    id: string;
    name: string;
    entry_id: string;
    division_id: string;
    division_name: string;
    season_name: string;
  }[];
}

export const getVerifiedSession = cache(async () => {
  const supabase = await createSupabaseServerClient(false);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
});

export const getOptionalSession = cache(async () => {
  const supabase = await createSupabaseServerClient(false);
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error || !data.user ? null : data.user };
});

export const getLeagueContext = cache(async () => {
  const { supabase, user } = await getOptionalSession();

  let domainLeagueId: string | undefined;
  try {
    const headerList = await headers();
    const host = (headerList.get("x-forwarded-host") || headerList.get("host") || "").toLowerCase().split(":")[0];
    if (DOMAIN_LEAGUE_MAP[host]) {
      domainLeagueId = DOMAIN_LEAGUE_MAP[host];
    } else {
      // Dynamic prefix matching for any custom/subdomain hierarchy (*.plaionn.brittosoft.online, *.dealioadvisors.com, etc.)
      if (host.startsWith("league1.") || host.startsWith("bhl.")) {
        domainLeagueId = "60000000-0000-4000-8000-000000000001";
      } else if (host.startsWith("league2.") || host.startsWith("wahl.")) {
        domainLeagueId = "60000000-0000-4000-8000-000000000003";
      } else if (host.startsWith("league3.") || host.startsWith("chl.")) {
        domainLeagueId = "60000000-0000-4000-8000-000000000004";
      } else if (host.startsWith("league4.") || host.startsWith("ihl.")) {
        domainLeagueId = "60000000-0000-4000-8000-000000000005";
      } else {
        const sub = host.split(".")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (sub && sub !== "www" && sub !== "plaionn" && sub !== "localhost") {
          // Look up matching real league in Supabase
          const { data: allDbLeagues } = await supabase.from("leagues").select("id, name");
          const matched = allDbLeagues?.find(
            (l) => l.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) === sub
          );
          if (matched) domainLeagueId = matched.id;
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  const userEmail = (user?.email || "").toLowerCase().trim();
  const metadataRole = (user?.user_metadata?.role || "").toLowerCase().trim();
  const isSuperAdmin = Boolean(
    userEmail &&
      (userEmail === "admin@plaionn.com" ||
        userEmail === "shadhin@plaionn.com" ||
        userEmail === "touhiduliet@gmail.com" ||
        metadataRole === "super admin" ||
        metadataRole === "super_admin") &&
      metadataRole !== "league admin" &&
      metadataRole !== "player"
  );
  const platformAdmin = isSuperAdmin ? { role: "super_admin" } : null;

  if (domainLeagueId === "platform") {
    return {
      supabase,
      user,
      league: {
        id: "platform",
        name: "PLAIONN Sports Platform",
      },
      leagueId: "platform",
      canManage: Boolean(platformAdmin),
      isGuest: !user,
      publicData: null,
    };
  }

  const cookieLeagueId = (await cookies()).get("plaionn-league")?.value;
  const selectedLeagueId = domainLeagueId && domainLeagueId !== "platform" ? domainLeagueId : cookieLeagueId;
  if (platformAdmin && selectedLeagueId) {
    const { data: league } = await supabase.from("leagues").select("id,name").eq("id", selectedLeagueId).maybeSingle();
    if (league) return { supabase, user, league, leagueId: league.id, canManage: true, isGuest: false, publicData: null as PublicLeagueOverview | null };
  }

  if (user) {
    const { data: memberships, error } = await supabase
      .from("league_memberships")
      .select("league_id,role")
      .eq("user_id", user.id);

    if (!error && memberships && memberships.length > 0) {
      const selected = selectedLeagueId;
      const membership =
        memberships.find((m) => m.league_id === selected) ??
        [...memberships].sort((a, b) => a.league_id.localeCompare(b.league_id))[0];

      const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .select("id,name")
        .eq("id", membership.league_id)
        .single();

      if (!leagueError && league) {
        return {
          supabase,
          user,
          league: {
            id: league.id,
            name: sanitizeLeagueName(league.name),
          },
          leagueId: league.id,
          canManage: memberships.some(
            (m) => m.league_id === league.id && m.role === "commissioner"
          ),
          isGuest: false,
          publicData: null as PublicLeagueOverview | null,
        };
      }
    }
  }

  // Guest or unauthenticated visitor:
  const selected = selectedLeagueId;
  const { data: overviewRows } = await supabase.rpc("get_public_league_overview", {
    target_league: selected || "60000000-0000-4000-8000-000000000001",
  });

  const overview = overviewRows?.[0] as PublicLeagueOverview | undefined;
  if (overview) {
    const leagueDisplayName = sanitizeLeagueName(overview.league_name);

    const sanitizedOverview: PublicLeagueOverview = {
      ...overview,
      league_name: leagueDisplayName,
      seasons: (overview.seasons || []).map((s) => ({
        ...s,
        name: sanitizeSeasonName(s.name),
      })),
      divisions: overview.divisions || [],
      teams: (overview.teams || []).map((t) => ({
        ...t,
        season_name: sanitizeSeasonName(t.season_name),
      })),
    };
    return {
      supabase,
      user,
      league: { id: overview.league_id, name: leagueDisplayName },
      leagueId: overview.league_id,
      canManage: false,
      isGuest: true,
      publicData: sanitizedOverview,
    };
  }

  // Do not substitute demo teams when a league is empty or unavailable.
  return {
    supabase, user, league: { id: selected || "platform", name: "No league data available" },
    leagueId: selected || "platform", canManage: false, isGuest: true,
    publicData: { league_id: selected || "platform", league_name: "No league data available", seasons: [], divisions: [], teams: [] } as PublicLeagueOverview,
  };
});
