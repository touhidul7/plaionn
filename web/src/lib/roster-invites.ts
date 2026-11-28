import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";

export const INTERNAL_EXPIRES_AT = "2000-01-01T00:00:00.000Z";
export const PENDING_SPOT_TITLE = "__PENDING_ROSTER_SPOT__";
export const JOIN_REQUEST_TITLE = "__TEAM_JOIN_REQUEST__";
export const WAIVER_SIGNED_TITLE = "__GHL_WAIVER_SIGNED__";

export type RosterClearanceStatus =
  | "Invited"
  | "Waiver needed"
  | "Payment due"
  | "Cleared to play";

export interface PendingRosterSpot {
  id: string; // league_announcements.id
  leagueId: string;
  seasonId: string | null;
  entryId: string;
  name: string;
  email: string | null;
  jersey: number | null;
  position: string;
  token: string;
  status: "invited" | "claimed" | "revoked";
  claimedByUserId?: string | null;
  claimedPlayerId?: string | null;
  registrationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamJoinRequest {
  id: string; // league_announcements.id
  leagueId: string;
  seasonId: string | null;
  entryId: string;
  userId: string;
  userEmail: string;
  displayName: string;
  position: string;
  jersey: number | null;
  status: "pending" | "approved" | "declined";
  matchedSpotId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaiverConfirmation {
  registrationId: string;
  playerId?: string | null;
  userId?: string | null;
  signedAt: string;
  source: "ghl_webhook" | "in_app_ghl" | "override";
}

function parseSpotRow(row: any): PendingRosterSpot | null {
  try {
    const parsed = JSON.parse(row.message);
    return {
      id: row.id,
      leagueId: row.league_id,
      seasonId: row.season_id ?? null,
      entryId: row.team_entry_id,
      name: parsed.name || "Player",
      email: parsed.email || null,
      jersey: parsed.jersey ?? null,
      position: parsed.position || "F",
      token: parsed.token,
      status: parsed.status || "invited",
      claimedByUserId: parsed.claimedByUserId ?? null,
      claimedPlayerId: parsed.claimedPlayerId ?? null,
      registrationId: parsed.registrationId ?? null,
      createdAt: parsed.createdAt || row.created_at,
      updatedAt: parsed.updatedAt || row.updated_at,
    };
  } catch {
    return null;
  }
}

function parseJoinRequestRow(row: any): TeamJoinRequest | null {
  try {
    const parsed = JSON.parse(row.message);
    return {
      id: row.id,
      leagueId: row.league_id,
      seasonId: row.season_id ?? null,
      entryId: row.team_entry_id,
      userId: parsed.userId,
      userEmail: parsed.userEmail || "",
      displayName: parsed.displayName || "Player",
      position: parsed.position || "F",
      jersey: parsed.jersey ?? null,
      status: parsed.status || "pending",
      matchedSpotId: parsed.matchedSpotId ?? null,
      createdAt: parsed.createdAt || row.created_at,
      updatedAt: parsed.updatedAt || row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function listTeamPendingSpots(entryId: string): Promise<PendingRosterSpot[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("league_announcements")
    .select("id, league_id, season_id, team_entry_id, message, created_at, updated_at")
    .eq("team_entry_id", entryId)
    .eq("title", PENDING_SPOT_TITLE)
    .order("created_at", { ascending: false });

  return (data || [])
    .map(parseSpotRow)
    .filter((s): s is PendingRosterSpot => s !== null && s.status === "invited");
}

export async function findPendingSpotByToken(token: string): Promise<PendingRosterSpot | null> {
  if (!token) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("league_announcements")
    .select("id, league_id, season_id, team_entry_id, message, created_at, updated_at")
    .eq("title", PENDING_SPOT_TITLE)
    .ilike("message", `%${token}%`)
    .limit(10);

  for (const row of data || []) {
    const spot = parseSpotRow(row);
    if (spot && spot.token === token) return spot;
  }
  return null;
}

export async function findPendingSpotById(spotId: string): Promise<PendingRosterSpot | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("league_announcements")
    .select("id, league_id, season_id, team_entry_id, message, created_at, updated_at")
    .eq("id", spotId)
    .eq("title", PENDING_SPOT_TITLE)
    .maybeSingle();

  return data ? parseSpotRow(data) : null;
}

export async function listTeamJoinRequests(entryId: string): Promise<TeamJoinRequest[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("league_announcements")
    .select("id, league_id, season_id, team_entry_id, message, created_at, updated_at")
    .eq("team_entry_id", entryId)
    .eq("title", JOIN_REQUEST_TITLE)
    .order("created_at", { ascending: false });

  return (data || [])
    .map(parseJoinRequestRow)
    .filter((r): r is TeamJoinRequest => r !== null && r.status === "pending");
}

export async function listLeagueWaiverConfirmations(leagueId: string): Promise<Set<string>> {
  const db = createServiceClient();
  const { data } = await db
    .from("league_announcements")
    .select("message")
    .eq("league_id", leagueId)
    .eq("title", WAIVER_SIGNED_TITLE);

  const confirmedIds = new Set<string>();
  for (const row of data || []) {
    try {
      const parsed = JSON.parse(row.message);
      if (parsed.registrationId) confirmedIds.add(String(parsed.registrationId));
      if (parsed.playerId) confirmedIds.add(String(parsed.playerId));
      if (parsed.userId) confirmedIds.add(String(parsed.userId));
    } catch {}
  }
  return confirmedIds;
}

export function computeClearanceStatus({
  isPendingInvite,
  hasWaiver,
  hasPaid,
  billingModel,
  hasOverride,
}: {
  isPendingInvite: boolean;
  hasWaiver: boolean;
  hasPaid: boolean;
  billingModel: string; // 'team' | 'player' | 'both'
  hasOverride: boolean;
}): RosterClearanceStatus {
  if (isPendingInvite) return "Invited";
  if (hasOverride) return "Cleared to play";
  if (!hasWaiver) return "Waiver needed";
  if (billingModel !== "team" && !hasPaid) return "Payment due";
  return "Cleared to play";
}
