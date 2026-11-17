import Link from "next/link";

export default function PlaionnPlatformPage() {
  const showcaseLeagues = [
    {
      name: "PLAIONN Premier League",
      acronym: "PLAIONN",
      domain: "plaionn.com",
      description: "Flagship hockey league featuring real-time scoreboard, automated schedules, and verified player statistics.",
      teams: 12,
      seasons: "Winter 2026, Summer 2025",
      featured: true,
      color: "var(--lime)",
    },
    {
      name: "Bangladesh Hockey League (BHL)",
      acronym: "BHL",
      domain: "bhl.com",
      description: "Official National Hockey Championship network with player registration and GoHighLevel digital waivers.",
      teams: 8,
      seasons: "Winter 2026, Summer 2025",
      featured: true,
      color: "#10b981",
    },
    {
      name: "Canada Hockey League (CHL)",
      acronym: "CHL",
      domain: "chl.com",
      description: "Elite developmental hockey circuit with verified player career logs and scoring leaders.",
      teams: 16,
      seasons: "Winter 2026, Fall 2025",
      featured: false,
      color: "#f59e0b",
    },
    {
      name: "Wave Adult Hockey League (WAHL)",
      acronym: "WAHL",
      domain: "waveadulthockeyleague.ca",
      description: "Adult recreational circuit with custom top scores ticker and horizontal navigation.",
      teams: 10,
      seasons: "Winter 2026",
      featured: false,
      color: "#60a5fa",
    },
  ];

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
      title: "GoHighLevel CRM & Digital Waivers",
      description:
        "Player registration with digital waiver signing synced to GoHighLevel CRM, supporting individual online pay, team manager pay, and offline tracking.",
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
    <div style={{ display: "flex", flexDirection: "column", gap: "48px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* 1. Marketing Navigation Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "var(--lime)",
              color: "#091219",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "20px",
            }}
          >
            P
          </div>
          <span style={{ fontFamily: "var(--font-inter), 'Inter', 'Inter Fallback', sans-serif", fontSize: "20px", fontWeight: 900, color: "var(--text)" }}>
            PLAIONN <span style={{ color: "var(--lime)", fontSize: "14px" }}>SPORTS</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link href="/admin" className="button button-sm button-outline">
            Super Admin Console ↗
          </Link>
          <Link href="/login" className="button button-sm primary">
            Admin Login
          </Link>
        </div>
      </div>

      {/* 2. Platform Hero Section (like TeamLinkt) */}
      <section
        style={{
          textAlign: "center",
          padding: "60px 20px 40px",
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
          Power your hockey league with branded public portals (like WAHL &amp; BHL), real-time rink scorekeeping, automated scheduling, and seamless GoHighLevel player registrations.
        </p>

        <div style={{ display: "flex", gap: "14px", marginTop: "10px", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/" className="button primary" style={{ padding: "14px 32px", fontSize: "15px", fontWeight: 800 }}>
            Explore Live League Portal →
          </Link>
          <Link href="/admin" className="button button-outline" style={{ padding: "14px 32px", fontSize: "15px" }}>
            Super Admin Backend
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: lg.color,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "16px",
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
                <Link href="/" className="button button-sm primary" style={{ width: "100%", justifyContent: "center" }}>
                  Visit Branded League Website ↗
                </Link>
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
          <Link href="/admin" className="button primary" style={{ padding: "12px 28px" }}>
            Open Central Super Admin
          </Link>
          <Link href="/login" className="button button-outline" style={{ padding: "12px 28px" }}>
            Administrator Login
          </Link>
        </div>
      </section>
    </div>
  );
}
