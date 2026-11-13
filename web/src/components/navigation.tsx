"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "⌂", "Home"],
  ["/announcements", "📢", "Notices"],
  ["/league", "▣", "League HQ"],
  ["/teams", "♧", "Teams"],
  ["/schedule", "▦", "Schedule"],
  ["/standings", "▤", "Standings"],
  ["/playoffs", "🏆", "Playoffs"],
  ["/spares", "🥅", "Spares"],
  ["/free-agents", "👥", "Free Agents"],
  ["/account", "○", "Account"],
] as const;

export function Navigation({ isGuest }: { isGuest?: boolean }) {
  const pathname = usePathname();

  const activeLinks = isGuest
    ? [
        ["/", "⌂", "Home"],
        ["/announcements", "📢", "Notices"],
        ["/schedule", "▦", "Schedule"],
        ["/standings", "▤", "Standings"],
        ["/playoffs", "🏆", "Playoffs"],
        ["/spares", "🥅", "Spares"],
        ["/free-agents", "👥", "Free Agents"],
        ["/teams", "♧", "Teams"],
        ["/login", "→", "Sign in"],
      ]
    : links;

  return (
    <nav aria-label="Main navigation">
      {activeLinks.map(([href, icon, label]) => {
        const isActive = pathname === href;
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
