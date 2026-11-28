import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { findPendingSpotByToken } from "@/lib/roster-invites";
import { ClaimSpotClient } from "@/components/claim-spot-client";
import { sanitizeSeasonName } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export default async function ClaimSpotPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main id="main" className="public-portal-container">
        <section className="panel empty" style={{ maxWidth: "540px", margin: "40px auto", textAlign: "center", padding: "36px" }}>
          <h2>Invalid Invite Link</h2>
          <p style={{ color: "var(--muted)" }}>
            This roster invite link is missing a token. Ask your team captain for a fresh single-use invite or the team join link.
          </p>
          <Link href="/" className="button primary">
            Return Home
          </Link>
        </section>
      </main>
    );
  }

  const spot = await findPendingSpotByToken(token);
  if (!spot || spot.status !== "invited") {
    return (
      <main id="main" className="public-portal-container">
        <section className="panel empty" style={{ maxWidth: "540px", margin: "40px auto", textAlign: "center", padding: "36px" }}>
          <h2>Invite Already Used or Expired</h2>
          <p style={{ color: "var(--muted)" }}>
            {spot?.status === "claimed"
              ? "This single-use invite link has already been claimed."
              : "This invite link is no longer valid. If your captain updated your email address, please use the newest invite link."}
          </p>
          <Link href="/" className="button primary">
            Return Home
          </Link>
        </section>
      </main>
    );
  }

  const db = createServiceClient();
  const { data: entry } = await db
    .from("team_entries")
    .select("id, teams(name), divisions(name, seasons(name)), leagues(name)")
    .eq("id", spot.entryId)
    .maybeSingle();

  const teamName = (entry?.teams as any)?.name || "Team";
  const seasonName = sanitizeSeasonName((entry?.divisions as any)?.seasons?.name || "Current Season");
  const leagueName = (entry?.leagues as any)?.name || "League";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main id="main" className="public-portal-container" style={{ paddingTop: "32px", paddingBottom: "48px" }}>
      <ClaimSpotClient
        token={token}
        spotName={spot.name}
        teamName={teamName}
        seasonName={seasonName}
        leagueName={leagueName}
        position={spot.position}
        jersey={spot.jersey}
        entryId={spot.entryId}
        userEmail={user?.email ?? null}
      />
    </main>
  );
}
