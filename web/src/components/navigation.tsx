"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const desktopMemberLinks = [
  ["/", "⌂", "Home"],
  ["/dashboard", "👤", "Player Hub"],
  ["/announcements", "📢", "Notices"],
  ["/league", "▣", "League HQ"],
  ["/schedule", "▦", "Schedules & Scores"],
  ["/standings", "▤", "Standings"],
  ["/leaders", "🎯", "Leaders"],
  ["/rankings", "⚡", "Rankings"],
  ["/playoffs", "🏆", "Playoffs"],
  ["/tournaments", "🏅", "Tournaments"],
  ["/teams", "♧", "Teams"],
  ["/spares", "🥅", "Spares"],
  ["/free-agents", "👥", "Free Agents"],
  ["/account", "○", "Account"],
] as const;

const desktopGuestLinks = [
  ["/", "⌂", "Home"],
  ["/announcements", "📢", "Notices"],
  ["/schedule", "▦", "Schedules & Scores"],
  ["/standings", "▤", "Standings"],
  ["/leaders", "🎯", "Leaders"],
  ["/rankings", "⚡", "Rankings"],
  ["/playoffs", "🏆", "Playoffs"],
  ["/tournaments", "🏅", "Tournaments"],
  ["/teams", "♧", "Teams"],
  ["/login", "→", "Sign in"],
] as const;

const mobilePrimaryLinks = [
  { href: "/", icon: "⌂", label: "Home" },
  { href: "/schedule", icon: "▦", label: "Schedule" },
  { href: "/standings", icon: "▤", label: "Standings" },
  { href: "/announcements", icon: "📢", label: "Notices" },
] as const;

const drawerMemberLinks = [
  { href: "/dashboard", icon: "👤", label: "Player Hub", description: "Personal stats, RSVP, and dues" },
  { href: "/league", icon: "▣", label: "League HQ", description: "Commissioner & league operations" },
  { href: "/leaders", icon: "🎯", label: "Leaders", description: "Skater & goalie leaderboards" },
  { href: "/rankings", icon: "⚡", label: "Rankings", description: "Power rankings & team metrics" },
  { href: "/playoffs", icon: "🏆", label: "Playoffs", description: "Tournament championship brackets" },
  { href: "/tournaments", icon: "🏅", label: "Tournaments", description: "Cross-league tournament pools" },
  { href: "/teams", icon: "♧", label: "Teams", description: "League directory & team rosters" },
  { href: "/spares", icon: "🥅", label: "Spares", description: "Emergency goalie & sub call-ups" },
  { href: "/free-agents", icon: "👥", label: "Free Agents", description: "Player discovery & open teams" },
  { href: "/account", icon: "○", label: "Account", description: "Profile, notifications, and privacy" },
] as const;

const drawerGuestLinks = [
  { href: "/leaders", icon: "🎯", label: "Leaders", description: "Skater & goalie leaderboards" },
  { href: "/rankings", icon: "⚡", label: "Rankings", description: "Power rankings & team metrics" },
  { href: "/playoffs", icon: "🏆", label: "Playoffs", description: "Tournament championship brackets" },
  { href: "/tournaments", icon: "🏅", label: "Tournaments", description: "Cross-league tournament pools" },
  { href: "/teams", icon: "♧", label: "Teams", description: "League directory & team rosters" },
  { href: "/login", icon: "→", label: "Sign In", description: "Access your player or commissioner portal" },
] as const;

export function Navigation({ isGuest }: { isGuest?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const desktopLinks = isGuest ? desktopGuestLinks : desktopMemberLinks;
  const drawerLinks = isGuest ? drawerGuestLinks : drawerMemberLinks;

  // Auto-close drawer on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    if (moreOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  const isDrawerRouteActive = drawerLinks.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  return (
    <>
      {/* 1. Desktop Sidebar Navigation */}
      <nav className="desktop-nav" aria-label="Main desktop navigation">
        {desktopLinks.map(([href, icon, label]) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 2. Mobile Bottom Bar Navigation (5 items max) */}
      <div className="mobile-bottom-bar" role="navigation" aria-label="Mobile navigation">
        {mobilePrimaryLinks.map(({ href, icon, label }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`mobile-tab-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="mobile-tab-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="mobile-tab-label">{label}</span>
              {isActive && <span className="mobile-active-pip" />}
            </Link>
          );
        })}

        {/* 5th Button: More Menu Trigger */}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={`mobile-tab-item mobile-more-trigger ${isDrawerRouteActive || moreOpen ? "active" : ""}`}
          aria-expanded={moreOpen}
          aria-label="Open more navigation options"
        >
          <span className="mobile-tab-icon" aria-hidden="true">
            {moreOpen ? "✕" : "☰"}
          </span>
          <span className="mobile-tab-label">More</span>
          {(isDrawerRouteActive || moreOpen) && <span className="mobile-active-pip" />}
        </button>
      </div>

      {/* 3. Mobile Slide-up "More" Drawer */}
      {moreOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMoreOpen(false)}>
          <div
            className="mobile-drawer-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All Navigation Destinations"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-drawer-header">
              <div>
                <p className="eyebrow" style={{ margin: "0 0 2px 0" }}>LEAGUE MENU</p>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>All Destinations</h3>
              </div>
              <button
                type="button"
                className="icon-btn mobile-drawer-close"
                onClick={() => setMoreOpen(false)}
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </div>

            <div className="mobile-drawer-grid">
              {drawerLinks.map(({ href, icon, label, description }) => {
                const isActive = pathname === href || pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`mobile-drawer-card ${isActive ? "active" : ""}`}
                    onClick={() => setMoreOpen(false)}
                  >
                    <span className="mobile-drawer-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <div className="mobile-drawer-meta">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
