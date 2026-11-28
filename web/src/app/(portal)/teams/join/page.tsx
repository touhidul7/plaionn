import Link from "next/link";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { TeamJoinClient } from "@/components/team-join-client";
import { sanitizeSeasonName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export default async function TeamJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  if (!team || !z.uuid().safeParse(team).success) {
    return (
      <main id="main" className="public-portal-container">
        <section className="panel empty" style={{ maxWidth: "540px", margin: "40px auto", textAlign: "center", padding: "36px" }}>
          <h2>Invalid Team Link</h2>
          <p style={{ color: "var(--muted)" }}>
            This team join link is missing a valid team ID. Ask your captain to share the link again.
          </p>
          <Link href="/teams" className="button primary">
            Browse Teams
          </Link>
        </section>
      </main>
    );
  }

  const db = createServiceClient();
  const { data: entry } = await db
    .from("team_entries")
    .select("id, teams(name), divisions(name, seasons(name)), leagues(name)")
    .eq("id", team)
    .maybeSingle();

  if (!entry) {
    return (
      <main id="main" className="public-portal-container">
        <section className="panel empty" style={{ maxWidth: "540px", margin: "40px auto", textAlign: "center", padding: "36px" }}>
          <h2>Team Not Found</h2>
          <p style={{ color: "var(--muted)" }}>We could not find this team.</p>
          <Link href="/teams" className="button primary">
            Browse Teams
          </Link>
        </section>
      </main>
    );
  }

  const teamName = (entry.teams as any)?.name || "Team";
  const seasonName = sanitizeSeasonName((entry.divisions as any)?.seasons?.name || "Current Season");
  const leagueName = (entry.leagues as any)?.name || "League";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main id="main" className="public-portal-container" style={{ paddingTop: "32px", paddingBottom: "48px" }}>
      <TeamJoinClient
        entryId={team}
        teamName={teamName}
        seasonName={seasonName}
        leagueName={leagueName}
        userEmail={user?.email ?? null}
        defaultName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || ""}
      />
    </main>
  );
}
