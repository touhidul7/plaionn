import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { getOptionalSession } from "@/lib/supabase/session";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getOptionalSession();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="brand-mark">P</span>
            <span>
              PLAIONN<small>HOCKEY NETWORK</small>
            </span>
          </Link>
          <p className="nav-label">THE PLATFORM</p>
          <Navigation isGuest={!user} />
          <div className="sidebar-note">
            <strong>Supabase connected</strong>
            <p>Records are saved to the configured project.</p>
          </div>
        </aside>

        <div>
          <header className="topbar">
            <Link className="mobile-brand" href="/">
              PLAIONN
            </Link>
            <span>PLAIONN HOCKEY NETWORK</span>
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

          <div className="notice">
            Connected Supabase data is persistent. Confirm this is the intended project and league
            before entering real participant information; existing sample records are not
            automatically replaced.
          </div>

          <main id="main" tabIndex={-1}>
            {children}
          </main>

          <footer>PLAIONN Hockey Network · Supabase-backed</footer>
        </div>
      </div>
    </>
  );
}
