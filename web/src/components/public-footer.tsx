import Link from "next/link";

export function PublicFooter({ leagueName }: { leagueName: string }) {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-top">
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontFamily: "var(--font-archivo), sans-serif", fontSize: "16px", fontWeight: 900, color: "var(--text)" }}>
              {leagueName}
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Official Adult &amp; Youth Hockey League · Powered by <strong style={{ color: "var(--lime)" }}>PLAIONN</strong>
            </span>
          </div>

          <div className="public-footer-links">
            <Link href="/">Home</Link>
            <Link href="/schedule">Schedules</Link>
            <Link href="/standings">Standings</Link>
            <Link href="/leaders">Stats</Link>
            <Link href="/teams">Team Pages</Link>
            <Link href="/registration">Registration</Link>
            <Link href="/announcements">League Info</Link>
          </div>
        </div>

        <div className="public-footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} {leagueName}. All rights reserved.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link href="/plaionn" style={{ color: "var(--lime)", fontWeight: 700 }}>
              Plaionn Sports Platform ↗
            </Link>
            <span style={{ opacity: 0.3 }}>|</span>
            <Link href="/admin" style={{ color: "var(--text)" }}>
              Central Admin Backend
            </Link>
            <span style={{ opacity: 0.3 }}>|</span>
            <Link href="/league" style={{ color: "var(--text)" }}>
              Commissioner HQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
