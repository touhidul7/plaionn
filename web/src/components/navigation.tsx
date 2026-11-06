"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [["/", "⌂", "Home"], ["/league", "▣", "League HQ"], ["/teams", "♧", "Teams"], ["/schedule", "▦", "Schedule"], ["/account", "○", "Account"]] as const;
export function Navigation() {
const pathname = usePathname();
return <nav aria-label="Main navigation">{links.map(([href, icon, label])=><Link key={href} href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>;
}
