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
  games: TickerGameItem[];
  user: any;
  canManage: boolean;
}

export function PublicHeaderClient({
  leagueName,
  games,
  user,
  canManage,
}: PublicHeaderClientProps) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

          {/* Right side actions */}
          <div className="plaionn-nav-right">
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {canManage && (
                  <Link
                    href="/league"
                    className="button button-sm"
                    style={{
                      background: "#183325",
                      color: "var(--lime)",
                      border: "1px solid rgba(199,244,80,0.3)",
                      fontWeight: 700,
                      fontSize: "12px",
                      padding: "6px 12px",
                    }}
                    title="Commissioner League HQ"
                  >
                    League HQ ⚙️
                  </Link>
                )}
                <Link
                  href="/admin"
                  className="button button-sm"
                  style={{
                    background: "#152430",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                    fontWeight: 700,
                    fontSize: "12px",
                    padding: "6px 12px",
                  }}
                  title="Admin Platform"
                >
                  Admin
                </Link>
                <Link
                  href="/account"
                  className="button button-sm"
                  style={{
                    background: "#101e28",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                    fontSize: "12px",
                    padding: "6px 12px",
                  }}
                >
                  Account
                </Link>
              </div>
            ) : (
              <Link href="/login" className="plaionn-admin-login-btn">
                Admin Login ↗
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
