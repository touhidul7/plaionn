import { getAdminAccess, listAdminLeagues } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CentralAdminShell } from "@/components/central-admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminManagementPage() {
  const access = await getAdminAccess();
  if (!access.user) redirect("/login");
  const visibleLeagues = await listAdminLeagues(access);
  const isLeagueAdminOnly = !access.isPlatformAdmin;
  const showUserSettings = access.isPlatformAdmin;

  const roleDefinitions = [
    {
      role: "Super Admin",
      scope: "Global Platform",
      permissions: "Full control over all leagues, domain routing, platform billing, global user deletion, server settings.",
      color: "#ef4444",
    },
    {
      role: "Regular Admin",
      scope: "Global Platform",
      permissions: "Manage all leagues, view platform KPIs, onboard leagues, manage user roles, view financial reports.",
      color: "#f59e0b",
    },
    {
      role: "League Admin / Commissioner",
      scope: "Specific League (e.g. BHL)",
      permissions: "Manage seasons, divisions, schedule generation, arena blackouts, approve rosters, staff management.",
      color: "#10b981",
    },
    {
      role: "Team Admin / Manager",
      scope: "Specific Team",
      permissions: "Submit rosters, assign jersey numbers, verify waivers, pay team fee, designate lines.",
      color: "#3b82f6",
    },
    {
      role: "Player",
      scope: "Individual",
      permissions: "Sign digital liability waiver, pay registration fee, view verified stats, RSVP for games.",
      color: "#8b5cf6",
    },
    {
      role: "Timekeeper",
      scope: "Assigned Games",
      permissions: "Digital rink scorekeeper app, record goals, assists, penalties, line-ups, and three stars.",
      color: "#06b6d4",
    },
    {
      role: "Referee",
      scope: "Assigned Games",
      permissions: "Review official scoresheet, sign-off on finalized game sheet, manage disciplinary penalties.",
      color: "#eab308",
    },
  ];

  return (
    <CentralAdminShell
      initialLeagues={visibleLeagues}
      isLeagueAdminOnly={isLeagueAdminOnly}
      showUserSettings={showUserSettings}
      roleDefinitions={roleDefinitions}
    />
  );
}
