import { createSupabaseServerClient } from "@/lib/supabase/server";

interface GameStar {
  star_number: number;
  player_id: string;
  display_name: string;
  jersey_number: number | null;
  team_name: string;
  headline: string | null;
}

export async function GameStarsBanner({ gameId }: { gameId: string }) {
  const supabase = await createSupabaseServerClient(false);

  const { data, error } = await supabase.rpc("get_game_stars", {
    target_game: gameId,
  });

  const stars = (!error && Array.isArray(data) ? data : []) as GameStar[];

  if (stars.length === 0) return null;

  const starConfig = [
    { num: 1, label: "1ST STAR", color: "#facc15", badgeBg: "#3a3010", emoji: "⭐" },
    { num: 2, label: "2ND STAR", color: "#e2e8f0", badgeBg: "#243242", emoji: "⭐" },
    { num: 3, label: "3RD STAR", color: "#fb923c", badgeBg: "#3a2215", emoji: "⭐" },
  ];

  return (
    <section
      aria-label="Three Stars of the Game"
      style={{
        marginBottom: "2rem",
        padding: "18px 22px",
        background: "#0c1921",
        border: "1px solid var(--line)",
        borderRadius: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--lime)",
          }}
        >
          🌟 Three Stars of the Game
        </span>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Official Game Honors</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
        }}
      >
        {stars.map((star) => {
          const cfg = starConfig.find((c) => c.num === star.star_number) || starConfig[0];

          return (
            <article
              key={star.star_number}
              style={{
                background: "#101e28",
                border: `1px solid ${cfg.color}40`,
                borderRadius: "10px",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: cfg.color,
                    background: cfg.badgeBg,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {cfg.label}
                </span>
                <span style={{ fontSize: "14px" }}>{cfg.emoji}</span>
              </div>

              <div>
                <strong style={{ fontSize: "15px", display: "block" }}>
                  {star.display_name}
                  {star.jersey_number !== null && (
                    <span style={{ opacity: 0.6, marginLeft: "4px" }}>#{star.jersey_number}</span>
                  )}
                </strong>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{star.team_name}</span>
              </div>

              {star.headline && (
                <p style={{ fontSize: "12px", color: "#66d6e9", margin: "4px 0 0", fontStyle: "italic" }}>
                  "{star.headline}"
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
