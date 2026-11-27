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
  if (leagueId === "platform") {
    // Aggregate announcements from all leagues using service client to bypass RLS
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const db = createServiceClient();
      const { data: allLeagues } = await db.from("leagues").select("id");
      if (allLeagues && allLeagues.length > 0) {
        const results = await Promise.all(
          allLeagues.map((lg: { id: string }) =>
            db.rpc("list_active_announcements", { target_league: lg.id })
          )
        );
        announcements = results.flatMap((r) =>
          !r.error && Array.isArray(r.data) ? (r.data as AnnouncementItem[]) : []
        );
      }
    } catch {
      // fallback empty
    }
  } else {
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

