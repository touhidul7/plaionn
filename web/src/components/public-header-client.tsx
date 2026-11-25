"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef } from "react";

export interface TickerGameItem {
  id: string;
  startsAt: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  arena: string;
}

interface PublicHeaderClientProps {
  leagueName: string;
  leagueId?: string;
  games: TickerGameItem[];
  user: any;
  canManage: boolean;
}

export function PublicHeaderClient({
  leagueName,
  leagueId,
  games,
  user,
  canManage,
}: PublicHeaderClientProps) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // If on admin or commissioner management back-office route, completely omit public website header
  if (pathname.startsWith("/admin") || pathname.startsWith("/league")) {
    return null;
  }

  const leagueInitial = (leagueName || "P").trim().charAt(0).toUpperCase();

  const scrollTicker = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -280 : 280;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const navLinks = [
    { href: "/", label: "HOME" },
    { href: "/schedule", label: "SCHEDULE" },
    { href: "/schedule?view=scores", label: "SCORES" },
    { href: "/standings", label: "STANDINGS" },
    { href: "/leaders", label: "STATS" },
    { href: "/teams", label: "TEAM PAGES" },
    { href: "/announcements", label: "LEAGUE INFO" },
    { href: "/registration", label: "REGISTRATION" },
  ];

  if (leagueName === "PLAIONN Sports Platform" || pathname === "/plaionn" || leagueId === "platform") {
    return (
      <header className="plaionn-header-wrap" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="plaionn-header-top" style={{ padding: "16px 0", background: "#081017" }}>
          <div
            className="plaionn-header-top-inner"
            style={{
              maxWidth: "1260px",
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Link href="/" className="plaionn-brand-wedge" title="PLAIONN Sports Platform">
              <div
                className="plaionn-brand-logo"
                aria-hidden="true"
                style={{ background: "var(--lime)", color: "#000", fontWeight: 900 }}
              >
                P
              </div>
              <div className="plaionn-brand-text">
                <span className="plaionn-brand-name" style={{ color: "var(--text)", letterSpacing: "0.5px" }}>
                  PLAIONN <span style={{ color: "var(--lime)" }}>SPORTS</span>
                </span>
                <span className="plaionn-brand-sub" style={{ color: "var(--muted)" }}>
                  Multi-Tenant Sports League Management
                </span>
              </div>
            </Link>

            <div>
              {user ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Link
                    href="/admin"
                    className="button primary"
                    style={{ fontWeight: 800, fontSize: "13.5px", padding: "7px 18px", borderRadius: "8px" }}
                  >
                    Admin Console
                  </Link>
                  <Link
                    href="/account"
                    className="button button-outline"
                    style={{ fontWeight: 700, fontSize: "13px", padding: "7px 14px", borderRadius: "8px" }}
                  >
                    Account
                  </Link>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="button primary"
                  style={{
                    fontWeight: 800,
                    fontSize: "14px",
                    padding: "8px 24px",
                    borderRadius: "8px",
                  }}
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }

  if (pathname?.startsWith("/admin")) {
    const activeLeagueParam = (pathname?.startsWith("/admin/league/") ? pathname.split("/admin/league/")[1]?.split("/")[0] : null)
      || (leagueId && leagueId !== "platform" ? leagueId : null);
    const publicLeagueUrl = activeLeagueParam
      ? `/api/switch-league?league=${activeLeagueParam}&redirect=/`
      : "/";

    return (
      <header className="plaionn-header-wrap" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="plaionn-header-top" style={{ padding: "14px 0", background: "#081017" }}>
          <div className="plaionn-header-top-inner" style={{ maxWidth: "1260px", margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/admin" className="plaionn-brand-wedge" title="Central Administration">
              <div className="plaionn-brand-logo" aria-hidden="true" style={{ background: "var(--lime)", color: "#000", fontWeight: 900 }}>
                ⚙
              </div>
              <div className="plaionn-brand-text">
                <span className="plaionn-brand-name" style={{ color: "var(--text)" }}>PLAIONN Multi-League Admin</span>
                <span className="plaionn-brand-sub" style={{ color: "var(--lime)", fontWeight: 700 }}>Central Management Console</span>
              </div>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link href={publicLeagueUrl} className="button button-sm button-outline" style={{ fontSize: "12px", padding: "6px 14px" }}>
                Public League Website ↗
              </Link>
              <Link href="/account" className="button button-sm button-outline" style={{ fontSize: "12px", padding: "6px 14px" }}>
                Account
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="plaionn-header-wrap">
      {/* 1. TOP TICKER ROW (Centered, Framed, No Empty Void) */}
      <div className="plaionn-header-top">
        <div className="plaionn-header-top-inner">
          {/* League Brand Crest */}
          <Link href="/" className="plaionn-brand-wedge" title={`Visit ${leagueName} Home`}>
            <div className="plaionn-brand-logo" aria-hidden="true">
              {leagueInitial}
            </div>
            <div className="plaionn-brand-text">
              <span className="plaionn-brand-name">{leagueName}</span>
              <span className="plaionn-brand-sub">Official Hockey League</span>
            </div>
          </Link>

          {/* Right Game Center & Scores Widget */}
          <div className="plaionn-ticker-container" aria-label="Scores Ticker">
            {games.length > 1 && (
              <button
                type="button"
                className="plaionn-ticker-arrow"
                onClick={() => scrollTicker("left")}
                aria-label="Scroll scores left"
              >
                ‹
              </button>
            )}

            <div className="plaionn-ticker-scroll" ref={scrollRef}>
              {games.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    background: "#0d1a22",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    fontSize: "12px",
                    color: "var(--muted)",
                  }}
                >
                  <span style={{ color: "var(--lime)", fontWeight: 800 }}>●</span>
                  <span>Season underway · Live scores and game tracking update here</span>
                </div>
              ) : (
                games.map((g) => {
                  const isFinal = g.status === "completed" || g.status === "final";
                  const isLive = g.status === "in_progress" || g.status === "live";

                  return (
                    <Link
                      key={g.id}
                      href={`/schedule/${g.id}/live`}
                      className="plaionn-game-card"
                      title={`${g.awayTeam} vs ${g.homeTeam}`}
                    >
                      <div className="plaionn-game-meta">
                        <span className="plaionn-game-date">{g.startsAt}</span>
                        <span
                          className={`plaionn-game-badge ${
                            isLive ? "live" : isFinal ? "final" : ""
                          }`}
                        >
                          {isLive ? "LIVE" : isFinal ? "FINAL" : "SCHEDULED"}
                        </span>
                      </div>

                      <div className="plaionn-game-teams">
                        <div className="plaionn-game-team-row">
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                            {g.awayTeam}
                          </span>
                          <span className="score">
                            {typeof g.awayScore === "number" ? g.awayScore : "—"}
                          </span>
                        </div>
                        <div className="plaionn-game-team-row">
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>
                            {g.homeTeam}
                          </span>
                          <span className="score">
                            {typeof g.homeScore === "number" ? g.homeScore : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="plaionn-game-arena">{g.arena}</div>
                    </Link>
                  );
                })
              )}
            </div>

            {games.length > 1 && (
              <button
                type="button"
                className="plaionn-ticker-arrow"
                onClick={() => scrollTicker("right")}
                aria-label="Scroll scores right"
              >
                ›
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. HORIZONTAL NAVIGATION BAR (Centered & Framed) */}
      <nav className="plaionn-navbar" aria-label="League Navigation">
        <div className="plaionn-navbar-inner">
          <button
            type="button"
            className="plaionn-mobile-menu-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>

          <ul className={`plaionn-nav-menu ${mobileOpen ? "open" : ""}`}>
            {navLinks.map((link) => {
              const isScores = link.href.includes("view=scores");
              const isSchedule = link.href === "/schedule";
              let isActive = false;
              if (link.href === "/") {
                isActive = pathname === "/";
              } else if (isScores) {
                isActive =
                  pathname === "/schedule" &&
                  typeof window !== "undefined" &&
                  window.location.search.includes("view=scores");
              } else if (isSchedule) {
                isActive =
                  pathname.startsWith("/schedule") &&
                  (typeof window === "undefined" ||
                    !window.location.search.includes("view=scores"));
              } else {
                isActive = pathname.startsWith(link.href.split("?")[0]);
              }

              return (
                <li key={link.href} className="plaionn-nav-item">
                  <Link
                    href={link.href}
                    className={isActive ? "active" : ""}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right side actions - Public View Only (Admin login moved to bottom of page per client requirements) */}
          <div className="plaionn-nav-right">
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Link
                  href="/account"
                  className="button button-sm button-outline"
                  style={{
                    fontSize: "12px",
                    padding: "6px 14px",
                  }}
                >
                  My Account
                </Link>
              </div>
            ) : (
              <Link
                href="/registration"
                className="button button-sm primary"
                style={{
                  fontSize: "12px",
                  padding: "6px 16px",
                  fontWeight: 800,
                }}
              >
                Join League
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
