import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

export default async function LeagueAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { league, canManage, user } = await getLeagueContext();

  const navItems = [
    { href: "/league", label: "HQ Overview", icon: "📊" },
    { href: "/league/governance", label: "Staff & Governance", icon: "🛡️" },
    { href: "/schedule", label: "Schedule & Fixtures", icon: "📅" },
    { href: "/league/registrations", label: "Registrations & CRM", icon: "📝" },
    { href: "/league/branding", label: "Branding & Domain", icon: "🌐" },
    { href: "/league/settings", label: "League Settings", icon: "⚙️" },
    { href: "/league/billing", label: "Billing & Fees", icon: "💳" },
    { href: "/league/officials", label: "Officials & Payroll", icon: "⏱️" },
    { href: "/league/discipline", label: "Discipline & Suspensions", icon: "⚖️" },
    { href: "/teams", label: "Team Rosters", icon: "👥" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "250px 1fr",
        minHeight: "100vh",
        background: "#060d13",
        color: "#f0f4f8",
      }}
    >
      {/* Instantly-Style Sticky Left Sidebar */}
      <aside
        style={{
          background: "#091219",
          borderRight: "1px solid #162634",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          height: "100vh",
          padding: "20px 16px",
          zIndex: 40,
        }}
      >
        <div>
          {/* League Brand Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingBottom: "16px",
              borderBottom: "1px solid #162634",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--lime)",
                color: "#081017",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "19px",
                flexShrink: 0,
              }}
            >
              {league.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "1.2px",
                  color: "var(--lime)",
                  textTransform: "uppercase",
                }}
              >
                COMMISSIONER HQ
              </div>
              <h1
                style={{
                  margin: "1px 0 0",
                  fontSize: "14.5px",
                  fontWeight: 800,
                  color: "#f0f4f8",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {league.name}
              </h1>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "15px" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div style={{ borderTop: "1px solid #162634", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <span>🌐</span>
            <span>View Public Site ↗</span>
          </Link>

          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <span>⚙️</span>
            <span>Platform Admin / All Leagues</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main" style={{ padding: "32px 40px", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
