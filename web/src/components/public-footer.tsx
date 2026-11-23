import Link from "next/link";

export function PublicFooter({ leagueName }: { leagueName: string }) {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div
          className="public-footer-bottom"
          style={{
            borderTop: "none",
            padding: "20px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span
              style={{
                fontFamily: "var(--font-inter), 'Inter', 'Inter Fallback', sans-serif",
                fontSize: "14.5px",
                fontWeight: 800,
                color: "var(--text)",
              }}
            >
              {leagueName}
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Official Sports League Management · Powered by{" "}
              <strong style={{ color: "var(--lime)" }}>PLAIONN</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <Link
              href="/login"
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                textDecoration: "none",
                background: "rgba(255,255,255,0.06)",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                transition: "all 0.2s ease",
              }}
              title="League Commissioner, Referee & Scorekeeper Login"
            >
              🔒 Admin Login
            </Link>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              &copy; {new Date().getFullYear()} {leagueName}. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
