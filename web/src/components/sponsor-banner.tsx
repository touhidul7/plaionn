import Link from "next/link";
import { getLeagueContext } from "@/lib/supabase/session";

interface Sponsor {
  sponsor_id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  placement_tier: string;
  tagline: string | null;
  display_order: number;
}

export async function SponsorBanner() {
  const { supabase, league } = await getLeagueContext();

  const { data, error } = await supabase.rpc("get_active_league_sponsors", {
    target_league: league.id,
  });

  const sponsors: Sponsor[] = (!error && Array.isArray(data)) ? (data as Sponsor[]) : [];

  if (sponsors.length === 0) return null;

  return (
    <section
      aria-label="League Sponsors"
      style={{
        marginTop: "2.5rem",
        marginBottom: "1rem",
        padding: "16px 20px",
        background: "#0a151d",
        border: "1px solid var(--line)",
        borderRadius: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "6px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted)",
          }}
        >
          Official {league.name} Partners &amp; Sponsors
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {sponsors.map((s) => {
          const content = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "#101e28",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>🤝</span>
              <div>
                <strong style={{ fontSize: "13px", display: "block" }}>{s.name}</strong>
                {s.tagline && (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{s.tagline}</span>
                )}
              </div>
            </div>
          );

          return s.website_url ? (
            <a
              key={s.sponsor_id}
              href={s.website_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              {content}
            </a>
          ) : (
            <div key={s.sponsor_id}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}
