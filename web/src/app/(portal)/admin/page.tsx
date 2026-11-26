import Link from "next/link";
import { getAdminAccess, listAdminLeagues } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { AdminLeaguesManager } from "@/components/admin-leagues-manager";
import { AdminSidebar } from "@/components/admin-sidebar";

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
    <main id="main" className="public-portal-container" style={{ paddingBottom: "60px" }}>
      {/* 2-Column Admin Shell: Left Navigation Bar + Main Management Body */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Sidebar with Bottom Gear Menu */}
        <AdminSidebar isSuperAdmin={showUserSettings} isLeagueAdminOnly={isLeagueAdminOnly} />

        {/* Right Main Admin Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Clean Header per Client Video 1 */}
          <section
            style={{
              background: "#0c1921",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "18px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text)" }}>
              {isLeagueAdminOnly
                ? `${visibleLeagues[0]?.name ?? "League"} Admin Console`
                : "Admin Console"}
            </h1>
          </section>

          {/* 1. Leagues & Branded Domains */}
          <AdminLeaguesManager initialLeagues={visibleLeagues} isLeagueAdminOnly={isLeagueAdminOnly} />

          {/* 2. Platform Users & User Types (Only visible to Super Admin - Requirement 3) */}
          {showUserSettings && (
            <section id="users" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <AdminUsersManager />

              {/* Embedded Roles & Permissions Matrix inside Users Page */}
              <div className="panel" style={{ padding: "24px", marginBottom: 0 }}>
                <div style={{ marginBottom: "18px" }}>
                  <h2 style={{ margin: 0, fontSize: "18px" }}>Platform Access Control &amp; Roles Matrix</h2>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                    Central administration enforces strict role separation across the entire ecosystem.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
                  {roleDefinitions.map((item) => (
                    <div
                      key={item.role}
                      style={{
                        background: "#0c1822",
                        border: "1px solid var(--line)",
                        borderRadius: "10px",
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: "14.5px", color: item.color }}>{item.role}</strong>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(255,255,255,0.08)",
                            color: "var(--muted)",
                          }}
                        >
                          {item.scope}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.4 }}>
                        {item.permissions}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

        </div>
      </div>
    </main>
  );
}
