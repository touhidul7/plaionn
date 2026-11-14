import { createSupabaseServerClient } from "@/lib/supabase/server";

interface AwardItem {
  award_id: string;
  code: string;
  award_title: string;
  player_id: string;
  display_name: string;
  jersey_number: number | null;
  team_name: string;
  division_name: string;
  citation: string | null;
}

const AWARD_EMOJIS: Record<string, string> = {
  MVP: "🏆",
  TOP_SCORER: "🎯",
  BEST_DEFENSEMAN: "🛡️",
  BEST_GOALTENDER: "🥅",
  PLAYOFF_MVP: "👑",
  SPORTSMANSHIP: "🤝",
  ROOKIE_OF_YEAR: "⚡",
  COACH_OF_YEAR: "📋",
};

export async function SeasonAwardsShowcase({ seasonId }: { seasonId: string }) {
  const supabase = await createSupabaseServerClient(false);

  const { data, error } = await supabase.rpc("get_season_awards", {
    target_season: seasonId,
  });

  const awards = (!error && Array.isArray(data) ? data : []) as AwardItem[];

  if (awards.length === 0) return null;

  return (
    <section className="panel" style={{ marginTop: "2rem" }}>
      <div className="section-heading" style={{ marginTop: 0 }}>
        <h2>🏆 Official Season Awards &amp; Honors</h2>
        <span className="badge">{awards.length} Trophies Awarded</span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0 0 1.25rem 0" }}>
        Official league honors recognized by the commissioner and competition committee.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {awards.map((award) => {
          const emoji = AWARD_EMOJIS[award.code] || "🏅";

          return (
            <article
              key={award.award_id}
              style={{
                background: "#0c1921",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--lime)",
                  }}
                >
                  {award.award_title}
                </span>
                <span style={{ fontSize: "1.25rem" }}>{emoji}</span>
              </div>

              <div>
                <strong style={{ fontSize: "1.05rem", display: "block" }}>
                  {award.display_name}
                  {award.jersey_number !== null && (
                    <span style={{ opacity: 0.6, marginLeft: "4px" }}>#{award.jersey_number}</span>
                  )}
                </strong>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {award.team_name} · {award.division_name}
                </span>
              </div>

              {award.citation && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "#a0b3bd",
                    margin: "4px 0 0",
                    background: "rgba(255,255,255,0.03)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    borderLeft: "2px solid var(--lime)",
                  }}
                >
                  "{award.citation}"
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
