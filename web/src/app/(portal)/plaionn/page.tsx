import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PlaionnPlatformPage() {
  const supabase = await createSupabaseServerClient(false);
  
  // Dynamically load all leagues from Supabase
  let showcaseLeagues: Array<{
    name: string;
    acronym: string;
    domain: string;
    url: string;
    description: string;
    teams: number;
    seasons: string;
    featured: boolean;
    color: string;
    leagueId: string;
  }> = [];

  const colors = ["#10b981", "#60a5fa", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

  try {
    const { data: dbLeagues } = await supabase.from("leagues").select("id, name, created_at").order("created_at", { ascending: false });
    const { data: dbSeasons } = await supabase.from("seasons").select("league_id, name");
    const { data: dbTeams } = await supabase.from("teams").select("league_id, id");

    if (dbLeagues && dbLeagues.length > 0) {
      showcaseLeagues = dbLeagues.map((lg, index) => {
        const slug = lg.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
        const acr = lg.name
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 4) || "LGE";
        const seasonName = dbSeasons?.find(s => s.league_id === lg.id)?.name || "Winter 2026";
        const teamCount = dbTeams?.filter(t => t.league_id === lg.id).length || 0;
        const color = colors[index % colors.length];

        return {
          name: lg.name,
          acronym: acr,
          domain: `${slug}.plaionn.brittosoft.online`,
          url: `/api/switch-league?league=${lg.id}&redirect=/`,
          description: `Dedicated multi-tenant league portal for ${lg.name} featuring real-time scoreboard, rosters, and schedules.`,
          teams: teamCount,
          seasons: seasonName,
          featured: index < 2,
          color,
          leagueId: lg.id,
        };
      });
    }
  } catch {
    // Fallback if query fails
  }

  if (showcaseLeagues.length === 0) {
    showcaseLeagues = [
      {
        name: "Bangladesh Hockey League (BHL)",
        acronym: "BHL",
        domain: "league1.plaionn.brittosoft.online",
        url: "/api/switch-league?league=60000000-0000-4000-8000-000000000001&redirect=/",
        description: "Official National Hockey Championship network with player registration and digital liability waivers.",
        teams: 8,
        seasons: "Winter 2026, Summer 2025",
        featured: true,
        color: "#10b981",
        leagueId: "60000000-0000-4000-8000-000000000001",
      },
    ];
  }

  const features = [
    {
      icon: "🌐",
      title: "Dedicated Branded League Websites",
      description:
        "Every league receives its own independent domain (e.g. bhl.com, chl.com) with top scores ticker, hero banner, standings, and zero admin dashboard clutter.",
    },
    {
      icon: "⏱",
      title: "theScore-Style Live Rink Scorekeeper",
      description:
        "Digital scorekeeper app for timekeepers with real-time linescore tables, scoring summaries, penalty logs, and Three Stars of the Game.",
    },
    {
      icon: "📅",
      title: "Intelligent Schedule & Arena Fairness Engine",
      description:
        "Automated ice slot allocation, blackout date handling, and balanced home/away game distribution across community rinks.",
    },
    {
      icon: "✍",
      title: "Digital Waivers & Registration",
      description:
        "Player registration with digital waiver signing and liability consent, supporting individual online pay, team manager pay, and offline tracking.",
    },
    {
      icon: "🔒",
      title: "6-Tier Role-Based Access Control",
      description:
        "Strict permission boundaries for Super Admin, Regular Admin, League Commissioner, Team Manager, Player, and Rink Timekeeper.",
    },
    {
      icon: "📊",
      title: "Automated Standings & Career Stats",
      description:
        "Instant tiebreaker calculations (PTS, W, DIFF, GF, GA) and clickable player profiles tracking goals, assists, and penalty minutes.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px", maxWidth: "1280px", margin: "0 auto", padding: "10px 0 40px" }}>
      {/* 1. Platform Hero Section */}
      <section
        style={{
          textAlign: "center",
          padding: "40px 20px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <span
          className="badge"
          style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontWeight: 800, letterSpacing: "1.5px" }}
        >
          ALL-IN-ONE SPORTS MANAGEMENT PLATFORM
        </span>

        <h1
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
            fontWeight: 900,
            lineHeight: 1.15,
            margin: 0,
            maxWidth: "960px",
            color: "#ffffff",
          }}
        >
          The Modern Management App for Leagues, Tournaments &amp; Arenas
        </h1>

        <p
          style={{
            fontSize: "17px",
            color: "var(--muted)",
            maxWidth: "760px",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Power your hockey league with branded public portals (like WAHL &amp; BHL), real-time rink scorekeeping, automated scheduling, and seamless digital player registrations.
        </p>

        <div style={{ display: "flex", gap: "14px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/login" className="button primary" style={{ padding: "14px 44px", fontSize: "16px", fontWeight: 800 }}>
            Login
          </Link>
        </div>
      </section>

      {/* 3. Multi-Tenant League Network Showcase (Unique Domains) */}
      <section>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "1.5px", color: "var(--lime)", textTransform: "uppercase" }}>
            MULTI-TENANT ECOSYSTEM
          </span>
          <h2 style={{ fontSize: "28px", margin: "6px 0 8px" }}>
            Independent Branded Websites with Unique Domains
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "14px", maxWidth: "680px", margin: "0 auto" }}>
            Each league runs on its own custom domain with dedicated branding, custom top scores ticker, and season archives.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          {showcaseLeagues.map((lg) => (
            <div
              key={lg.domain}
              className="panel"
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginBottom: 0,
                borderTop: `4px solid ${lg.color}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                <span
                  style={{
                    height: "36px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    background: lg.color,
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "13.5px",
                    letterSpacing: "0.5px",
                    lineHeight: 1,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lg.acronym}
                </span>
                <code
                  style={{
                    background: "#0c1822",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    color: "var(--lime)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {lg.domain}
                </code>
              </div>

              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "17px" }}>{lg.name}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.4 }}>
                  {lg.description}
                </p>
              </div>

              <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div><strong>Seasons:</strong> {lg.seasons}</div>
                <div><strong>Teams:</strong> {lg.teams} Active Clubs</div>
              </div>

              <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                <a href={lg.url} className="button button-sm primary" style={{ width: "100%", justifyContent: "center" }}>
                  Visit {lg.acronym} League Portal ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Core Capabilities (TeamLinkt Comparison) */}
      <section style={{ marginTop: "20px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "28px", margin: "0 0 8px" }}>Complete Sports Management Architecture</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            Engineered specifically for adult and competitive sports organizations.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {features.map((feat) => (
            <div
              key={feat.title}
              className="panel"
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: 0,
              }}
            >
              <span style={{ fontSize: "28px" }}>{feat.icon}</span>
              <h3 style={{ margin: 0, fontSize: "17px" }}>{feat.title}</h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", lineHeight: 1.5 }}>
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Call To Action Footer Banner */}
      <section
        style={{
          background: "#0c1921",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          marginBottom: "40px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "26px", color: "var(--text)" }}>
          Ready to launch your league on PLAIONN?
        </h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "15px", maxWidth: "600px" }}>
          Create your league, configure your custom domain, and launch a branded public website in minutes.
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <Link href="/login" className="button primary" style={{ padding: "12px 36px", fontSize: "15px", fontWeight: 800 }}>
            Login
          </Link>
        </div>
      </section>
    </div>
  );
}
