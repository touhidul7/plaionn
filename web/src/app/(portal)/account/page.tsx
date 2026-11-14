import Link from "next/link";
import { getVerifiedSession } from "@/lib/supabase/session";
import { selectLeague, signOut } from "@/app/login/actions";
import { CreateLeagueForm, ExploreDemoLeagueButton } from "@/components/create-league-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, user } = await getVerifiedSession();
  const { data: memberships, error } = await supabase
    .from("league_memberships")
    .select("league_id,role")
    .eq("user_id", user.id);

  const ids = [...new Set((memberships ?? []).map((m) => m.league_id))];
  const result = ids.length
    ? await supabase.from("leagues").select("id,name").in("id", ids)
    : { data: [], error: null };

  const hasLeagues = Boolean(ids.length && result.data?.length);
  const isCommissioner = memberships?.some((m) => m.role === "commissioner");

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Welcome to PLAIONN.</h1>
          <p>{user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit">Sign out</button>
        </form>
      </div>

      <section className="panel">
        <h2>Your leagues</h2>
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
          <Link className="text-link" href="/dashboard">
            👤 Go to Player Hub Dashboard →
          </Link>
          <Link className="text-link" href="/account/notifications">
            🔔 Notification &amp; SMS alerts →
          </Link>
          <Link className="text-link" href="/registration">
            Apply for an open season →
          </Link>
          {isCommissioner && (
            <Link className="text-link" href="/league/registrations">
              Review player registrations →
            </Link>
          )}
        </div>

        {error || result.error ? (
          <p role="alert">
            The league database is not available yet. Please verify your Supabase connection.
          </p>
        ) : !hasLeagues ? (
          <div className="empty">
            <h2>No leagues yet</h2>
            <p>
              You can create your own league, explore the pre-seeded demo, or apply to an open season.
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>
              Account ID: <code>{user.id}</code>
            </p>
          </div>
        ) : (
          result.data?.map((league) => (
            <form action={selectLeague} className="list-row" key={league.id}>
              <input type="hidden" name="leagueId" value={league.id} />
              <h2>{league.name}</h2>
              <p>
                {memberships
                  ?.filter((m) => m.league_id === league.id)
                  .map((m) => m.role)
                  .join(" · ")}
              </p>
              <button className="primary" type="submit">
                Open league →
              </button>
            </form>
          ))
        )}
      </section>

      {/* League Creation Form - available to start your first league or create additional leagues */}
      <div style={{ marginTop: "24px" }}>
        <CreateLeagueForm hasLeagues={hasLeagues} />
      </div>

      {/* Demo League quick access for clients/reviewers */}
      <ExploreDemoLeagueButton />
    </>
  );
}
