import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";
import { sanitizeLeagueName, sanitizeSeasonName } from "@/lib/sanitize";

export const DOMAIN_LEAGUE_MAP: Record<string, string> = {
  // Main Platform Root Domains
  "plaionn.brittosoft.online": "platform",
  "plaionn.vercel.app": "platform",
  "plaionn.com": "platform",
  "www.plaionn.com": "platform",

  // Test & Client domains: *.plaionn.brittosoft.online
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

export const DEFAULT_LEAGUES_DATA: Record<string, PublicLeagueOverview> = {
  "60000000-0000-4000-8000-000000000001": {
    league_id: "60000000-0000-4000-8000-000000000001",
    league_name: "Bangladesh Hockey League (BHL)",
    seasons: [
      { id: "60000000-0000-4000-8000-000000000002", name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000012", name: "Summer 2025" },
    ],
    divisions: [
      { id: "60000000-0000-4000-8000-000000000003", name: "Premier Division", season_id: "60000000-0000-4000-8000-000000000002" },
    ],
    teams: [
      { id: "60000000-0000-4000-8000-000000000011", name: "Dhaka Gladiators", entry_id: "60000000-0000-4000-8000-000000000021", division_id: "60000000-0000-4000-8000-000000000003", division_name: "Premier Division", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000012", name: "Chittagong Warriors", entry_id: "60000000-0000-4000-8000-000000000022", division_id: "60000000-0000-4000-8000-000000000003", division_name: "Premier Division", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000013", name: "Sylhet Strikers", entry_id: "60000000-0000-4000-8000-000000000023", division_id: "60000000-0000-4000-8000-000000000003", division_name: "Premier Division", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000014", name: "Rajshahi Rangers", entry_id: "60000000-0000-4000-8000-000000000024", division_id: "60000000-0000-4000-8000-000000000003", division_name: "Premier Division", season_name: "Winter 2026" },
    ],
  },
  "60000000-0000-4000-8000-000000000003": {
    league_id: "60000000-0000-4000-8000-000000000003",
    league_name: "Wave Adult Hockey League (WAHL)",
    seasons: [
      { id: "60000000-0000-4000-8000-000000000032", name: "Winter 2026" },
    ],
    divisions: [
      { id: "60000000-0000-4000-8000-000000000033", name: "Adult Rec Division A", season_id: "60000000-0000-4000-8000-000000000032" },
    ],
    teams: [
      { id: "60000000-0000-4000-8000-000000000034", name: "Harbour Wolves", entry_id: "60000000-0000-4000-8000-000000000035", division_id: "60000000-0000-4000-8000-000000000033", division_name: "Adult Rec Division A", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000036", name: "Wave Breakers", entry_id: "60000000-0000-4000-8000-000000000037", division_id: "60000000-0000-4000-8000-000000000033", division_name: "Adult Rec Division A", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000038", name: "Coastal Frost", entry_id: "60000000-0000-4000-8000-000000000039", division_id: "60000000-0000-4000-8000-000000000033", division_name: "Adult Rec Division A", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000040", name: "Metro Blades", entry_id: "60000000-0000-4000-8000-000000000041", division_id: "60000000-0000-4000-8000-000000000033", division_name: "Adult Rec Division A", season_name: "Winter 2026" },
    ],
  },
  "60000000-0000-4000-8000-000000000004": {
    league_id: "60000000-0000-4000-8000-000000000004",
    league_name: "Canada Hockey League (CHL)",
    seasons: [
      { id: "60000000-0000-4000-8000-000000000042", name: "Winter 2026" },
    ],
    divisions: [
      { id: "60000000-0000-4000-8000-000000000043", name: "Eastern Conference", season_id: "60000000-0000-4000-8000-000000000042" },
    ],
    teams: [
      { id: "60000000-0000-4000-8000-000000000044", name: "Ottawa Titans", entry_id: "60000000-0000-4000-8000-000000000045", division_id: "60000000-0000-4000-8000-000000000043", division_name: "Eastern Conference", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000046", name: "Montreal Royals", entry_id: "60000000-0000-4000-8000-000000000047", division_id: "60000000-0000-4000-8000-000000000043", division_name: "Eastern Conference", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000048", name: "Toronto Maple Hawks", entry_id: "60000000-0000-4000-8000-000000000049", division_id: "60000000-0000-4000-8000-000000000043", division_name: "Eastern Conference", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000050", name: "Vancouver Grizzlies", entry_id: "60000000-0000-4000-8000-000000000051", division_id: "60000000-0000-4000-8000-000000000043", division_name: "Eastern Conference", season_name: "Winter 2026" },
    ],
  },
  "60000000-0000-4000-8000-000000000005": {
    league_id: "60000000-0000-4000-8000-000000000005",
    league_name: "Italy Hockey League (IHL)",
    seasons: [
      { id: "60000000-0000-4000-8000-000000000052", name: "Winter 2026" },
    ],
    divisions: [
      { id: "60000000-0000-4000-8000-000000000053", name: "Serie A1", season_id: "60000000-0000-4000-8000-000000000052" },
    ],
    teams: [
      { id: "60000000-0000-4000-8000-000000000054", name: "Milano Vipers", entry_id: "60000000-0000-4000-8000-000000000055", division_id: "60000000-0000-4000-8000-000000000053", division_name: "Serie A1", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000056", name: "Roma Gladiators", entry_id: "60000000-0000-4000-8000-000000000057", division_id: "60000000-0000-4000-8000-000000000053", division_name: "Serie A1", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000058", name: "Torino Ice", entry_id: "60000000-0000-4000-8000-000000000059", division_id: "60000000-0000-4000-8000-000000000053", division_name: "Serie A1", season_name: "Winter 2026" },
      { id: "60000000-0000-4000-8000-000000000060", name: "Bolzano Foxes", entry_id: "60000000-0000-4000-8000-000000000061", division_id: "60000000-0000-4000-8000-000000000053", division_name: "Serie A1", season_name: "Winter 2026" },
    ],
  },
};

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

  if (domainLeagueId === "platform") {
    return {
      supabase,
      user,
      league: {
        id: "platform",
        name: "PLAIONN Sports Platform",
      },
      leagueId: "platform",
      canManage: Boolean(user),
      isGuest: !user,
      publicData: null,
    };
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
    const isBhl = domainLeagueId === "60000000-0000-4000-8000-000000000001";
    const leagueDisplayName = isBhl ? "Bangladesh Hockey League (BHL)" : sanitizeLeagueName(overview.league_name);

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

  // Clean fallback for known league IDs or default
  const fallback =
    (selected && DEFAULT_LEAGUES_DATA[selected]) ||
    DEFAULT_LEAGUES_DATA["60000000-0000-4000-8000-000000000001"];

  return {
    supabase,
    user,
    league: {
      id: fallback.league_id,
      name: fallback.league_name,
    },
    leagueId: fallback.league_id,
    canManage: false,
    isGuest: true,
    publicData: fallback,
  };
});
