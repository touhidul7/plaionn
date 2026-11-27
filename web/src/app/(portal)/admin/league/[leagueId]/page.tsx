import { notFound } from "next/navigation";
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

  const supabase = await createSupabaseServerClient(true);

  // Fetch seasons, divisions, teams, games, venues, rinks, staff, registrations, overrides
  const [
    seasonsRes,
    divisionsRes,
    teamsRes,
    gamesRes,
    venuesRes,
    rinksRes,
    staffRes,
    settingsRes,
    regsRes,
    rosterMembersRes,
    overridesRes,
    eventsRes,
  ] = await Promise.all([
    supabase.from("seasons").select("id, name").eq("league_id", leagueId).order("name"),
    supabase.from("divisions").select("id, name, season_id, seasons(name)").eq("league_id", leagueId),
    supabase.from("team_entries").select("id, team_id, division_id, teams(id, name), divisions(id, name, seasons(name))").eq("league_id", leagueId),
    supabase.from("games").select("id, starts_at, status, home_entry_id, away_entry_id, rink_id").eq("league_id", leagueId).order("starts_at", { ascending: false }).limit(40),
    supabase.from("venues").select("id, name, time_zone, address").eq("league_id", leagueId),
    supabase.from("rinks").select("id, name, venue_id").eq("league_id", leagueId),
    supabase.rpc("get_league_staff_members", { target_league: leagueId }),
    supabase.from("season_settings").select("*").eq("league_id", leagueId).limit(1),
    supabase.from("player_registrations").select("id, status, position, user_id, player_id, created_at").eq("league_id", leagueId),
    supabase.from("roster_memberships").select("id, player_id, team_entry_id, jersey_number, position, status").eq("league_id", leagueId),
    supabase.from("player_eligibility_overrides").select("id, reason, granted_at").eq("league_id", leagueId).is("revoked_at", null),
    supabase.from("game_events").select("id, game_id, team_entry_id, event_kind, period, player_id, recorded_at").eq("league_id", leagueId).order("recorded_at", { ascending: true }),
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

  const rawEvents = eventsRes.data || [];
  const games = (gamesRes.data || []).map((g: any) => {
    const gameGoals = rawEvents.filter((e: any) => e.game_id === g.id && e.event_kind === "goal");
    const homeScore = gameGoals.filter((e: any) => e.team_entry_id === g.home_entry_id).length;
    const awayScore = gameGoals.filter((e: any) => e.team_entry_id === g.away_entry_id).length;
    return {
      id: g.id,
      starts_at: g.starts_at,
      status: g.status,
      home_entry_id: g.home_entry_id,
      away_entry_id: g.away_entry_id,
      home_name: teamNameMap.get(g.home_entry_id) || "Home Team",
      away_name: teamNameMap.get(g.away_entry_id) || "Away Team",
      home_score: homeScore,
      away_score: awayScore,
      rink_name: rinkNameMap.get(g.rink_id) || "Rink 1",
    };
  });

  const staff = (!staffRes.error && Array.isArray(staffRes.data)) ? staffRes.data : [];
  const settings = settingsRes.data?.[0] || null;

  // Resolve player profiles for registrations and rosters
  const rawRegs = regsRes.data || [];
  const rawRoster = rosterMembersRes.data || [];
  const allPlayerIds = Array.from(
    new Set([
      ...rawRegs.map((r: any) => r.player_id),
      ...rawRoster.map((r: any) => r.player_id),
    ])
  ).filter(Boolean);

  const { data: resolvedPlayers } = allPlayerIds.length > 0
    ? await supabase.from("players").select("id, display_name").in("id", allPlayerIds)
    : { data: [] };
  const playerNameMap = new Map((resolvedPlayers || []).map((p: any) => [p.id, p.display_name]));

  const registrations = rawRegs.map((r: any) => ({
    id: r.id,
    playerName: playerNameMap.get(r.player_id) || "Registered Player",
    position: r.position,
    status: r.status,
    createdAt: new Date(r.created_at).toLocaleDateString(),
  }));

  const rosterPlayers = rawRoster.map((r: any) => ({
    id: r.id,
    playerId: r.player_id,
    playerName: playerNameMap.get(r.player_id) || "Roster Player",
    teamEntryId: r.team_entry_id,
    teamName: teamNameMap.get(r.team_entry_id) || "Assigned Team",
    jerseyNumber: r.jersey_number,
    position: r.position || "F",
    status: r.status || "active",
  }));

  const adminData: LeagueAdminData = {
    league: {
      id: league.id,
      name: league.name,
      season: league.season,
      teams: teams.length,
    },
    allLeagues: leagues.map((l) => ({ id: l.id, name: l.name })),
    seasons,
    divisions,
    teams,
    rosterPlayers,
    games,
    gameEvents: rawEvents,
    venues: venuesRes.data || [],
    rinks: rinksRes.data || [],
    staff,
    registrations,
    rosterCount: rosterPlayers.length,
    overridesCount: (overridesRes.data || []).length,
    settings,
  };

  return <LeagueAdminShell data={adminData} initialTab={tab || "overview"} />;
}
