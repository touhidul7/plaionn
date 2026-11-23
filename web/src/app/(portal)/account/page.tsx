import Link from "next/link";
import { getVerifiedSession } from "@/lib/supabase/session";
import { selectLeague, signOut } from "@/app/login/actions";
import { CreateLeagueForm } from "@/components/create-league-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { sanitizeLeagueName } from "@/lib/sanitize";

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
    <main id="main" className="public-portal-container">
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
          <Link className="text-link" href="/account/privacy">
            🛡️ Privacy &amp; data control →
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
              You can create your own league or apply to an open season.
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>
              Account ID: <code>{user.id}</code>
            </p>
          </div>
        ) : (
          result.data?.map((league) => (
            <form action={selectLeague} className="list-row" key={league.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <input type="hidden" name="leagueId" value={league.id} />
              <div>
                <h2 style={{ margin: "0 0 4px 0" }}>{sanitizeLeagueName(league.name)}</h2>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)" }}>
                  Role: {memberships
                    ?.filter((m) => m.league_id === league.id)
                    .map((m) => m.role)
                    .join(" · ")}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Link
                  href={`/admin/league/${league.id}`}
                  className="button primary"
                  style={{ textDecoration: "none", fontWeight: 800, padding: "8px 16px", fontSize: "13px" }}
                >
                  Manage League Backend →
                </Link>
                <button className="button" type="submit" style={{ padding: "8px 14px", fontSize: "13px" }}>
                  Set Active
                </button>
              </div>
            </form>
          ))
        )}
      </section>

      {/* League Creation Form - available to start your first league or create additional leagues */}
      <div style={{ marginTop: "24px" }}>
        <CreateLeagueForm hasLeagues={hasLeagues} />
      </div>

      {/* Change Password Form */}
      <ChangePasswordForm />
    </main>
  );
}
