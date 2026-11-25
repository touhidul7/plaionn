import { notFound, redirect } from "next/navigation";
import { getAdminAccess, listAdminLeagues } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeagueAdminShell, type LeagueAdminData } from "@/components/league-admin-shell";

export const dynamic = "force-dynamic";

export default async function LeagueBackendPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { leagueId } = await params;
  const { tab } = await searchParams;
  const access = await getAdminAccess();
  if (!access.user || !access.canManageLeague(leagueId)) notFound();

  const leagues = await listAdminLeagues(access);
  const league = leagues.find((l) => l.id === leagueId);
  if (!league) notFound();

  const supabase = await createSupabaseServerClient(false);

  // Fetch seasons, divisions, teams, games, venues, rinks, staff
  const [seasonsRes, divisionsRes, teamsRes, gamesRes, venuesRes, rinksRes, staffRes, settingsRes] = await Promise.all([
    supabase.from("seasons").select("id, name").eq("league_id", leagueId).order("name"),
    supabase.from("divisions").select("id, name, season_id, seasons(name)").eq("league_id", leagueId),
    supabase.from("team_entries").select("id, team_id, division_id, teams(id, name), divisions(id, name, seasons(name))").eq("league_id", leagueId),
    supabase.from("games").select("id, starts_at, status, home_entry_id, away_entry_id, rink_id").eq("league_id", leagueId).order("starts_at", { ascending: false }).limit(40),
    supabase.from("venues").select("id, name, time_zone, address").eq("league_id", leagueId),
    supabase.from("rinks").select("id, name, venue_id").eq("league_id", leagueId),
    supabase.rpc("get_league_staff_members", { target_league: leagueId }),
    supabase.from("season_settings").select("*").eq("league_id", leagueId).limit(1),
  ]);

  const seasons = seasonsRes.data || [];
  const divisions = (divisionsRes.data || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    season_id: d.season_id,
    season_name: d.seasons?.name || "Regular Season",
  }));

  const teams = (teamsRes.data || []).map((t: any) => ({
    id: t.teams?.id || t.id,
    entry_id: t.id,
    name: t.teams?.name || "Team",
    division_name: t.divisions?.name || "Division",
    season_name: t.divisions?.seasons?.name || "Winter 2026",
  }));

  const teamNameMap = new Map(teams.map((t) => [t.entry_id, t.name]));
  const rinkNameMap = new Map((rinksRes.data || []).map((r) => [r.id, r.name]));

  const games = (gamesRes.data || []).map((g: any) => ({
    id: g.id,
    starts_at: g.starts_at,
    status: g.status,
    home_name: teamNameMap.get(g.home_entry_id) || "Home Team",
    away_name: teamNameMap.get(g.away_entry_id) || "Away Team",
    rink_name: rinkNameMap.get(g.rink_id) || "Rink 1",
  }));

  const staff = (!staffRes.error && Array.isArray(staffRes.data)) ? staffRes.data : [];
  const settings = settingsRes.data?.[0] || null;

  const adminData: LeagueAdminData = {
    league: {
      id: league.id,
      name: league.name,
      season: league.season,
      teams: teams.length,
    },
    seasons,
    divisions,
    teams,
    games,
    venues: venuesRes.data || [],
    rinks: rinksRes.data || [],
    staff,
    settings,
  };

  return <LeagueAdminShell data={adminData} initialTab={tab || "overview"} />;
}
