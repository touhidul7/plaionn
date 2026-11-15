"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  currentLeagueId?: string;
}

const PRESET_LEAGUES = [
  { id: "60000000-0000-4000-8000-000000000001", name: "Wave Adult Hockey League (WAHL)", abbr: "WAHL", domain: "waveadulthockeyleague.ca" },
  { id: "60000000-0000-4000-8000-000000000002", name: "Bangladesh Hockey League (BHL)", abbr: "BHL", domain: "bhl.com" },
  { id: "60000000-0000-4000-8000-000000000003", name: "Canada Hockey League (CHL)", abbr: "CHL", domain: "chl.com" },
  { id: "60000000-0000-4000-8000-000000000004", name: "Italy Hockey League (IHL)", abbr: "IHL", domain: "ihl.com" },
];

export function PublicHeaderClient({
  leagueName,
  games,
  user,
  canManage,
  currentLeagueId,
}: PublicHeaderClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Compute acronym/short mark
  const words = (leagueName || "WAHL").split(/\s+/).filter(Boolean);
  const acronym =
    words.length > 1
      ? words.map((w) => w[0]).join("").toUpperCase().slice(0, 4)
      : leagueName.slice(0, 4).toUpperCase();

  const scrollTicker = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleLeagueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    document.cookie = `plaionn-league=${selectedId}; path=/; max-age=31536000`;
    router.refresh();
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
    <header className="wahl-header-wrap">
      {/* 1. TOP TICKER ROW (WAHL reference: Slanted puck logo on left + score cards) */}
      <div className="wahl-header-top">
        <Link href="/" className="wahl-brand-wedge" title={`Visit ${leagueName} Home`}>
          <div className="wahl-puck-logo" aria-hidden="true">
            {acronym}
          </div>
          <div className="wahl-brand-text">
            <span className="wahl-brand-name">{leagueName}</span>
            <span className="wahl-brand-sub">Powered by Plaionn</span>
          </div>
        </Link>

        {/* Ticker Track with Prev/Next controls */}
        <div className="wahl-ticker-container" aria-label="Scores Ticker">
          <button
            type="button"
            className="wahl-ticker-arrow"
            onClick={() => scrollTicker("left")}
            aria-label="Scroll scores left"
          >
            ‹
          </button>

          <div className="wahl-ticker-scroll" ref={scrollRef}>
            {games.map((g) => {
              const isFinal = g.status === "completed" || g.status === "final";
              const isLive = g.status === "in_progress" || g.status === "live";

              return (
                <Link
                  key={g.id}
                  href={`/schedule/${g.id}/live`}
                  className="wahl-game-card"
                  title={`${g.awayTeam} vs ${g.homeTeam}`}
                >
                  <div className="wahl-game-meta">
                    <span className="wahl-game-date">{g.startsAt}</span>
                    <span
                      className={`wahl-game-badge ${
                        isLive ? "live" : isFinal ? "final" : ""
                      }`}
                    >
                      {isLive ? "LIVE" : isFinal ? "FINAL" : "SCHEDULED"}
                    </span>
                  </div>

                  <div className="wahl-game-teams">
                    <div className="wahl-game-team-row">
                      <span>{g.awayTeam}</span>
                      <span className="score">
                        {typeof g.awayScore === "number" ? g.awayScore : "—"}
                      </span>
                    </div>
                    <div className="wahl-game-team-row">
                      <span>{g.homeTeam}</span>
                      <span className="score">
                        {typeof g.homeScore === "number" ? g.homeScore : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="wahl-game-arena">{g.arena}</div>
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            className="wahl-ticker-arrow"
            onClick={() => scrollTicker("right")}
            aria-label="Scroll scores right"
          >
            ›
          </button>
        </div>
      </div>

      {/* 2. HORIZONTAL ROYAL BLUE NAVIGATION BAR */}
      <nav className="wahl-navbar" aria-label="League Navigation">
        <button
          type="button"
          className="wahl-mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>

        <ul className={`wahl-nav-menu ${mobileOpen ? "open" : ""}`}>
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href.split("?")[0]);

            return (
              <li key={link.href} className="wahl-nav-item">
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

        {/* Right side actions: League switcher, Admin Login & Management */}
        <div className="wahl-nav-right">
          {/* League Switcher (demonstrating multi-tenancy: BHL, WAHL, CHL, IHL) */}
          <select
            className="wahl-league-select"
            value={currentLeagueId || "60000000-0000-4000-8000-000000000001"}
            onChange={handleLeagueChange}
            title="Switch Branded League"
            aria-label="Select League"
          >
            {PRESET_LEAGUES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.abbr} ({l.domain})
              </option>
            ))}
          </select>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {canManage && (
                <Link
                  href="/league"
                  className="wahl-admin-login-btn"
                  style={{ background: "#10b981" }}
                  title="Commissioner League HQ"
                >
                  League HQ ⚙️
                </Link>
              )}
              <Link
                href="/admin"
                className="wahl-admin-login-btn"
                style={{ background: "#4f46e5" }}
                title="Super Admin Central Platform"
              >
                Super Admin
              </Link>
              <Link
                href="/account"
                className="wahl-admin-login-btn"
                style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Account
              </Link>
            </div>
          ) : (
            <Link href="/login" className="wahl-admin-login-btn">
              Admin Login ↗
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
