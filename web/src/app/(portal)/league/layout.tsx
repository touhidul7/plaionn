import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

export default async function LeagueAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { league, canManage, user } = await getLeagueContext();

  return (
    <main id="main" className="public-portal-container">
      {/* Commissioner Management Banner */}
      <div
        style={{
          background: "#0c1b26",
          border: "1px solid #1f394d",
          borderRadius: "12px",
          padding: "16px 24px",
          marginBottom: "28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "var(--lime)",
              color: "#091219",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 900,
            }}
          >
            ⚙
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px", color: "var(--lime)", textTransform: "uppercase" }}>
                Commissioner Management Console
              </span>
              <span className="badge" style={{ fontSize: "10px", padding: "1px 6px" }}>
                {league.name}
              </span>
            </div>
            <h2 style={{ margin: "2px 0 0", fontSize: "18px", color: "var(--text)" }}>
              League Administration &amp; Governance
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" className="button button-sm button-outline">
            ← View Public League Site
          </Link>
          <Link href="/admin" className="button button-sm button-outline">
            Admin Platform ↗
          </Link>
        </div>
      </div>

      {/* Commissioner Subnav Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--line)",
          marginBottom: "24px",
          overflowX: "auto",
          paddingBottom: "8px",
        }}
      >
        <Link href="/league" className="button button-sm">
          HQ Overview
        </Link>
        <Link href="/league/governance" className="button button-sm primary">
          Staff &amp; Roles Management
        </Link>
        <Link href="/schedule" className="button button-sm">
          Schedule &amp; Rinks
        </Link>
        <Link href="/league/branding" className="button button-sm">
          Branding &amp; Domain
        </Link>
        <Link href="/league/settings" className="button button-sm">
          League Settings
        </Link>
        <Link href="/league/registrations" className="button button-sm">
          Registrations &amp; CRM
        </Link>
      </div>

      {children}
    </main>
  );
}
