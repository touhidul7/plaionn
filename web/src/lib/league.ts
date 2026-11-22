import "server-only";
import { getLeagueContext, type PublicLeagueOverview } from "./supabase/session";
import { sanitizeLeagueName, sanitizeSeasonName } from "./sanitize";

export type NamedRecord = { id: string; name: string };
export type Division = NamedRecord & { season_id: string; season_name: string };
export type TeamEntry = NamedRecord & { entry_id: string; division_name: string; season_name: string };

export async function getLeagueData() {
  const context = await getLeagueContext();
  const { supabase, league, canManage, user, isGuest } = context;

  // Platform root has no league-specific data
  if (league.id === "platform") {
    return {
      seasons: [] as NamedRecord[],
      divisions: [] as Division[],
      teams: [] as TeamEntry[],
      league,
      canManage,
      isGuest: true,
      user,
    };
  }

  if (isGuest && context.publicData) {
    const { seasons, divisions, teams } = context.publicData;
    const seasonMap = new Map((seasons || []).map((s) => [s.id, s]));
    const divisionRows: Division[] = (divisions || []).map((d) => ({
      id: d.id,
      name: d.name,
      season_id: d.season_id,
      season_name: seasonMap.get(d.season_id)?.name ?? "Unavailable season",
    }));

    const teamRows: TeamEntry[] = (teams || []).map((t) => ({
      id: t.id,
      name: t.name,
      entry_id: t.entry_id,
      division_name: t.division_name,
      season_name: t.season_name,
    }));

    return {
      seasons: seasons || [],
      divisions: divisionRows,
      teams: teamRows,
      league,
      canManage: false,
      isGuest: true,
      user: null,
    };
  }

  // If user is authenticated, query tables directly
  if (user) {
    const [seasons, divisions, teams, entries] = await Promise.all([
      supabase.from("seasons").select("id,name").eq("league_id", league.id).order("name").returns<NamedRecord[]>(),
      supabase.from("divisions").select("id,name,season_id").eq("league_id", league.id).order("name").returns<(NamedRecord & { season_id: string })[]>(),
      supabase.from("teams").select("id,name").eq("league_id", league.id).order("name").returns<NamedRecord[]>(),
      supabase.from("team_entries").select("id,team_id,division_id").eq("league_id", league.id).returns<{ id: string; team_id: string; division_id: string }[]>(),
    ]);

    if (![seasons, divisions, teams, entries].some((result) => result.error)) {
      const sanitizedSeasons = seasons.data!.map((s) => ({
        ...s,
        name: sanitizeSeasonName(s.name),
      }));
      const seasonMap = new Map(sanitizedSeasons.map((s) => [s.id, s]));
      const divisionRows: Division[] = divisions.data!.map((d) => ({
        ...d,
        season_name: sanitizeSeasonName(seasonMap.get(d.season_id)?.name ?? "Winter 2026"),
      }));
      const divisionMap = new Map(divisionRows.map((d) => [d.id, d]));
      const teamMap = new Map(teams.data!.map((t) => [t.id, t]));
      const teamRows: TeamEntry[] = entries.data!.map((entry) => {
        const team = teamMap.get(entry.team_id);
        const division = divisionMap.get(entry.division_id);
        return {
          id: team?.id ?? entry.team_id,
          name: team?.name ?? "Team",
          entry_id: entry.id,
          division_name: division?.name ?? "Division",
          season_name: sanitizeSeasonName(division?.season_name ?? "Winter 2026"),
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      return {
        seasons: sanitizedSeasons,
        divisions: divisionRows,
        teams: teamRows,
        league: {
          ...league,
          name: sanitizeLeagueName(league.name),
        },
        canManage,
        isGuest: false,
        user,
      };
    }
  }

  // Fallback to public RPC
  const { data: overviewRows } = await supabase.rpc("get_public_league_overview", {
    target_league: league.id,
  });

  const overview = overviewRows?.[0] as PublicLeagueOverview | undefined;
  const seasons = (overview?.seasons || []).map((s) => ({
    ...s,
    name: sanitizeSeasonName(s.name),
  }));
  const seasonMap = new Map(seasons.map((s) => [s.id, s]));
  const divisionRows: Division[] = (overview?.divisions || []).map((d) => ({
    id: d.id,
    name: d.name,
    season_id: d.season_id,
    season_name: sanitizeSeasonName(seasonMap.get(d.season_id)?.name ?? "Winter 2026"),
  }));
  const teamRows: TeamEntry[] = (overview?.teams || []).map((t) => ({
    id: t.id,
    name: t.name,
    entry_id: t.entry_id,
    division_name: t.division_name,
    season_name: sanitizeSeasonName(t.season_name),
  }));

  return {
    seasons,
    divisions: divisionRows,
    teams: teamRows,
    league: {
      ...league,
      name: sanitizeLeagueName(league.name),
    },
    canManage,
    isGuest: true,
    user: null,
  };
}
