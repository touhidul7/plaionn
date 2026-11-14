import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { SponsorBanner } from "@/components/sponsor-banner";
import { getLeagueContext } from "@/lib/supabase/session";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, league, isGuest } = await getLeagueContext();

  const leagueInitial = (league?.name || "P").trim().charAt(0).toUpperCase();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="brand-mark">{leagueInitial}</span>
            <span className="brand-info">
              <span className="brand-title">{league.name}</span>
              <small>LEAGUE PORTAL</small>
            </span>
          </Link>
          <p className="nav-label">LEAGUE NAVIGATION</p>
          <Navigation isGuest={isGuest} />
          <div className="sidebar-note">
            <strong>{league.name}</strong>
            <p>Official Hockey League</p>
          </div>
        </aside>

        <div>
          <header className="topbar">
            <Link className="mobile-brand" href="/">
              {league.name}
            </Link>
            <span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>{league.name}</span>
            {user ? (
              <Link className="button button-sm" href="/account">
                My account
              </Link>
            ) : (
              <Link className="button button-sm primary" href="/login">
                Sign in ↗
              </Link>
            )}
          </header>

          <main id="main" tabIndex={-1}>
            {children}
            <SponsorBanner />
          </main>

          <footer>{league.name} · Powered by PLAIONN Hockey Network</footer>
        </div>
      </div>
    </>
  );
}
