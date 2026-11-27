import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { FreeAgentsView, type PendingApplicationItem } from "@/components/free-agents-view";
import type { FreeAgentProfileItem, TeamVacancyItem } from "@/lib/free-agents-schema";

export const dynamic = "force-dynamic";

export default async function FreeAgentsPage() {
  const [data, context] = await Promise.all([getLeagueData(), getLeagueContext()]);
  const { supabase, leagueId, canManage, user } = context;

  // 1. Fetch free agent profiles & 2. team vacancies
  let freeAgents: FreeAgentProfileItem[] = [];
  let vacancies: TeamVacancyItem[] = [];

  if (leagueId === "platform") {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const db = createServiceClient();
      const { data: allLeagues } = await db.from("leagues").select("id");
      if (allLeagues && allLeagues.length > 0) {
        const [faResults, vacResults] = await Promise.all([
          Promise.all(allLeagues.map((lg: { id: string }) => db.rpc("list_free_agents", { target_league: lg.id }))),
          Promise.all(allLeagues.map((lg: { id: string }) => db.rpc("list_team_vacancies", { target_league: lg.id }))),
        ]);
        freeAgents = faResults.flatMap((r) => (!r.error && Array.isArray(r.data) ? (r.data as FreeAgentProfileItem[]) : []));
        vacancies = vacResults.flatMap((r) => (!r.error && Array.isArray(r.data) ? (r.data as TeamVacancyItem[]) : []));
      }
    } catch {}
  } else {
    const [faRes, vacRes] = await Promise.all([
      supabase.rpc("list_free_agents", { target_league: leagueId }),
      supabase.rpc("list_team_vacancies", { target_league: leagueId }),
    ]);
    freeAgents = !faRes.error && Array.isArray(faRes.data) ? (faRes.data as FreeAgentProfileItem[]) : [];
    vacancies = !vacRes.error && Array.isArray(vacRes.data) ? (vacRes.data as TeamVacancyItem[]) : [];
  }

  // 3. Fetch user-owned players for registration & application
  let userPlayers: { id: string; name: string }[] = [];
  if (user) {
    const { data: owned } = await supabase
      .from("players")
      .select("id, display_name")
      .eq("owner_user_id", user.id);

    if (owned && owned.length > 0) {
      userPlayers = owned.map((p) => ({ id: p.id, name: p.display_name }));
    }
  }

  // 4. Fetch pending applications for commissioner review
  let pendingApplications: PendingApplicationItem[] = [];
  if (canManage) {
    const { data: appRows } = await supabase
      .from("free_agent_applications")
      .select(`
        id,
        vacancy_id,
        player_id,
        status,
        message,
        created_at,
        players (
          display_name
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (appRows && Array.isArray(appRows)) {
      pendingApplications = appRows.map((a: any) => ({
        id: a.id,
        vacancy_id: a.vacancy_id,
        player_id: a.player_id,
        player_name: a.players?.display_name || "Unknown Player",
        status: a.status,
        message: a.message,
        created_at: a.created_at,
      }));
    }
  }

  // Format team entries and divisions
  const teamEntries = (data.teams || []).map((t) => ({
    entry_id: t.entry_id,
    name: t.name,
    division_name: t.division_name,
  }));

  const divisions = (data.divisions || []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/" className="hover:text-white transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-zinc-200">Free Agents & Tryouts</span>
      </div>

      <FreeAgentsView
        freeAgents={freeAgents}
        vacancies={vacancies}
        pendingApplications={pendingApplications}
        canManage={canManage}
        userPlayers={userPlayers}
        teamEntries={teamEntries}
        divisions={divisions}
      />
    </div>
  );
}

