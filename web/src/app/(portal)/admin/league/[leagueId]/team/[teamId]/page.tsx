import { notFound, redirect } from "next/navigation";
import { createServiceClient, getAdminAccess } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function AdminTeamPage({ params }: { params: Promise<{ leagueId: string; teamId: string }> }) {
  const { leagueId, teamId } = await params;
  const access = await getAdminAccess();
  if (!access.user || !access.canManageLeague(leagueId)) notFound();
  const db = access.isPlatformAdmin ? createServiceClient() : access.supabase;
  const { data, error } = await db.from("team_entries").select("id").eq("league_id", leagueId).eq("team_id", teamId).order("id").limit(1);
  if (error || !data?.length) notFound();
  redirect(`/api/switch-league?league=${leagueId}&redirect=${encodeURIComponent(`/teams/${data[0].id}`)}`);
}
