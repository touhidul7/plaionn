import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";
import { sanitizeLeagueName, sanitizeSeasonName } from "@/lib/sanitize";

export const DOMAIN_LEAGUE_MAP: Record<string, string> = {
  // Test & Client domains: *.plaionn.brittosoft.online
  "plaionn.brittosoft.online": "60000000-0000-4000-8000-000000000001",
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
      }
    }
  } catch {
    // Graceful fallback
  }

  if (user) {
    const { data: memberships, error } = await supabase
      .from("league_memberships")
      .select("league_id,role")
      .eq("user_id", user.id);

    if (!error && memberships && memberships.length > 0) {
      const selected = domainLeagueId || (await cookies()).get("plaionn-league")?.value;
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
  const selected = domainLeagueId || (await cookies()).get("plaionn-league")?.value;
  const { data: overviewRows } = await supabase.rpc("get_public_league_overview", {
    target_league: selected || "60000000-0000-4000-8000-000000000001",
  });

  const overview = overviewRows?.[0] as PublicLeagueOverview | undefined;
  if (overview) {
    const sanitizedOverview: PublicLeagueOverview = {
      ...overview,
      league_name: sanitizeLeagueName(overview.league_name),
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
      league: { id: overview.league_id, name: sanitizedOverview.league_name },
      leagueId: overview.league_id,
      canManage: false,
      isGuest: true,
      publicData: sanitizedOverview,
    };
  }

  // Clean fallback
  return {
    supabase,
    user,
    league: {
      id: "60000000-0000-4000-8000-000000000001",
      name: "PLAIONN Hockey League",
    },
    leagueId: "60000000-0000-4000-8000-000000000001",
    canManage: false,
    isGuest: true,
    publicData: null as PublicLeagueOverview | null,
  };
});
