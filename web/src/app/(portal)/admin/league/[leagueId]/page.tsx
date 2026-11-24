import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminAccess, listAdminLeagues } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function LeagueBackendPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const access = await getAdminAccess();
  if (!access.user || !access.canManageLeague(leagueId)) notFound();
  const league = (await listAdminLeagues(access)).find(l => l.id === leagueId);
  if (!league) notFound();
  const links = [
    ["Seasons, divisions & teams", "/league"], ["Team rosters", "/teams"],
    ["Schedule & results", "/schedule"], ["Registration", "/league/registrations"],
    ["Billing & fees", "/league/billing"], ["Staff & permissions", "/league/governance"],
    ["League settings", "/league/settings"],
  ];
  return <main id="main" className="public-portal-container">
    <div className="page-heading"><div><p className="eyebrow">LEAGUE ADMINISTRATION</p><h1>{league.name}</h1><p>{league.season} ? {league.teams} registered teams</p></div><Link href="/admin" className="button">My leagues</Link></div>
    <section className="panel"><h2>Manage this league</h2><p>Open a section to view and update your saved league records.</p>
      <div className="cards">{links.map(([label, path]) => <a key={path} className="button primary" href={`/api/switch-league?league=${leagueId}&redirect=${encodeURIComponent(path)}`}>{label}</a>)}</div>
    </section>
  </main>;
}
