import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";

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

  if (user) {
    const { data: memberships, error } = await supabase
      .from("league_memberships")
      .select("league_id,role")
      .eq("user_id", user.id);

    if (!error && memberships && memberships.length > 0) {
      const selected = (await cookies()).get("plaionn-league")?.value;
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
          league,
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
  const selected = (await cookies()).get("plaionn-league")?.value;
  const { data: overviewRows } = await supabase.rpc("get_public_league_overview", {
    target_league: selected || "60000000-0000-4000-8000-000000000001",
  });

  const overview = overviewRows?.[0] as PublicLeagueOverview | undefined;
  if (overview) {
    return {
      supabase,
      user,
      league: { id: overview.league_id, name: overview.league_name },
      leagueId: overview.league_id,
      canManage: false,
      isGuest: true,
      publicData: overview,
    };
  }

  // Graceful fallback to client demo
  return {
    supabase,
    user,
    league: {
      id: "60000000-0000-4000-8000-000000000001",
      name: "PLAIONN Client Demo",
    },
    leagueId: "60000000-0000-4000-8000-000000000001",
    canManage: false,
    isGuest: true,
    publicData: null as PublicLeagueOverview | null,
  };
});
