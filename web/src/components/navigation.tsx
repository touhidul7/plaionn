"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const memberLinks = [
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

const guestLinks = [
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

export function Navigation({ isGuest }: { isGuest?: boolean }) {
  const pathname = usePathname();
  const activeLinks = isGuest ? guestLinks : memberLinks;

  return (
    <nav aria-label="Main navigation">
      {activeLinks.map(([href, icon, label]) => {
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
  );
}
