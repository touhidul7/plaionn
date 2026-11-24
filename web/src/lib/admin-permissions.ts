export function resolveAdminPermissions(
  userId: string | null,
  platformRole: string | null,
  memberships: { league_id: string; role: string }[],
) {
  const isPlatformAdmin = Boolean(userId) && ["super_admin", "admin"].includes(platformRole ?? "");
  const leagueIds = new Set(userId ? memberships.filter(m => m.role === "commissioner").map(m => m.league_id) : []);
  return { isPlatformAdmin, leagueIds, canManageLeague: (id: string) => isPlatformAdmin || leagueIds.has(id) };
}
