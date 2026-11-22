import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { AnnouncementsView } from "@/components/announcements-view";
import type { AnnouncementItem } from "@/lib/announcements-schema";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const [data, context] = await Promise.all([getLeagueData(), getLeagueContext()]);
  const { supabase, leagueId, canManage } = context;

  let announcements: AnnouncementItem[] = [];
  if (leagueId !== "platform") {
    const { data: rows, error } = await supabase.rpc("list_active_announcements", {
      target_league: leagueId,
    });
    announcements = !error && Array.isArray(rows) ? (rows as AnnouncementItem[]) : [];
  }

  const teamsList = (data.teams || []).map((t) => ({
    entryId: t.entry_id,
    name: t.name,
  }));

  return (
    <main id="main" className="public-portal-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BROADCASTS &amp; ALERTS</p>
          <h1>League Announcements</h1>
          <p>{data.league.name} · Urgent Notices, Rink Updates &amp; Team Bulletins</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href="/schedule">
            Schedule
          </Link>
          <Link className="button" href="/league">
            League HQ
          </Link>
        </div>
      </div>

      <AnnouncementsView
        announcements={announcements}
        teams={teamsList}
        canManage={canManage}
      />
    </main>
  );
}

