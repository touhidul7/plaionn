import Link from "next/link";
import { getOptionalSession, getLeagueContext } from "@/lib/supabase/session";
import { RegistrationForm, RegistrationDecision } from "@/components/registration-forms";
import { openSeasonsSchema } from "@/lib/registration-schema";

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const { supabase, user } = await getOptionalSession();
  const { league } = await getLeagueContext();

  if (!user) {
    return (
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "20px 0" }}>
        <div className="page-heading" style={{ marginBottom: "24px" }}>
          <div>
            <span className="badge" style={{ marginBottom: "8px" }}>
              PLAYER REGISTRATION &amp; WAIVERS
            </span>
            <h1 style={{ fontSize: "28px", margin: "4px 0 6px" }}>Player Registration</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {league.name} · Official player sign-up, digital waivers, and payment processing.
            </p>
          </div>
        </div>

        <section className="panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h2 style={{ fontSize: "20px", margin: "0 0 8px" }}>Welcome to Official Registration</h2>
            <p style={{ color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              To register as a player for an active team, sign required liability waivers with instant GoHighLevel CRM sync, and complete your league payment, please sign in to your player account.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              padding: "16px 0",
            }}
          >
            <div style={{ padding: "16px", background: "#0c1822", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>1️⃣</div>
              <strong style={{ display: "block", fontSize: "14px", color: "var(--text)" }}>Select Team</strong>
              <small style={{ color: "var(--muted)" }}>Choose your registered club and roster spot.</small>
            </div>

            <div style={{ padding: "16px", background: "#0c1822", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>2️⃣</div>
              <strong style={{ display: "block", fontSize: "14px", color: "var(--text)" }}>Digital Waiver</strong>
              <small style={{ color: "var(--muted)" }}>Instant liability consent synced to GoHighLevel CRM.</small>
            </div>

            <div style={{ padding: "16px", background: "#0c1822", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "22px", marginBottom: "6px" }}>3️⃣</div>
              <strong style={{ display: "block", fontSize: "14px", color: "var(--text)" }}>Flexible Payment</strong>
              <small style={{ color: "var(--muted)" }}>Individual online pay, team manager pay, or offline.</small>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
            <Link href="/login?next=/registration" className="button primary" style={{ padding: "12px 28px" }}>
              Sign In to Register Player ↗
            </Link>
            <Link href="/teams" className="button button-outline" style={{ padding: "12px 24px" }}>
              Browse Teams
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const [available, profile, requests] = await Promise.all([
    supabase.rpc("open_registration_seasons"),
    supabase.from("players").select("display_name").eq("owner_user_id", user.id).maybeSingle(),
    supabase
      .from("player_registrations")
      .select("id,season_id,season_name,league_name,status,position,revision,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const seasons = openSeasonsSchema.safeParse(available.data);
  if (available.error || profile.error || requests.error || !seasons.success) {
    return (
      <section className="panel">
        <h1>Registration unavailable</h1>
        <p>Please try again after registration setup is complete.</p>
      </section>
    );
  }

  const [documentRows, decisions, acceptances, consents] = await Promise.all([
    seasons.data.length
      ? supabase
          .from("season_documents")
          .select("id,season_id,document_type,title,version,object_path")
          .in(
            "season_id",
            seasons.data.map((s) => s.season_id)
          )
      : { data: [], error: null },
    requests.data.length
      ? supabase
          .from("registration_audit")
          .select("id,registration_id,changed_at,new_status,reason")
          .in(
            "registration_id",
            requests.data.map((r) => r.id)
          )
          .order("changed_at", { ascending: false })
      : { data: [], error: null },
    requests.data.length
      ? supabase
          .from("registration_document_acceptances")
          .select("id,registration_id,document_title,document_version,signer_name,accepted_at")
          .in(
            "registration_id",
            requests.data.map((r) => r.id)
          )
          .order("accepted_at", { ascending: false })
      : { data: [], error: null },
    requests.data.length
      ? supabase
          .from("registration_consents")
          .select("id,registration_id,consent_type,consent_text,granted,recorded_at")
          .in(
            "registration_id",
            requests.data.map((r) => r.id)
          )
          .order("recorded_at", { ascending: false })
      : { data: [], error: null },
  ]);

  if (documentRows.error) {
    return (
      <section className="panel">
        <h1>Registration documents unavailable</h1>
        <p>Reload the page or contact your league commissioner.</p>
      </section>
    );
  }

  const currentDocuments = new Map<string, (typeof documentRows.data)[number]>();
  for (const document of [...documentRows.data].sort((a, b) => b.version - a.version)) {
    if (!currentDocuments.has(document.season_id + ":" + document.document_type)) {
      currentDocuments.set(document.season_id + ":" + document.document_type, document);
    }
  }

  const signedDocuments = await Promise.all(
    [...currentDocuments.values()].map(async (document) => {
      const { data, error } = await supabase.storage
        .from("league-documents")
        .createSignedUrl(document.object_path, 600);
      return { ...document, url: error || !data ? null : data.signedUrl };
    })
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">JOIN THE ICE</p>
          <h1>Player registration</h1>
          <p>Apply to an open season and follow your application here.</p>
        </div>
        <Link className="button" href="/account">
          My leagues
        </Link>
      </div>

      {!seasons.data.length && <p>No seasons are accepting applications right now.</p>}

      <RegistrationForm
        seasons={seasons.data.filter((s) => !requests.data.some((r) => r.season_id === s.season_id))}
        documents={signedDocuments}
        name={profile.data?.display_name}
      />

      <div className="section-heading">
        <h2>Your applications</h2>
      </div>

      {!requests.data.length && (
        <section className="panel empty">
          <p>No applications yet.</p>
        </section>
      )}

      {requests.data.map((r) => (
        <section className="panel" key={r.id}>
          <h3>
            {r.league_name} · {r.season_name}
          </h3>
          <p>
            <span className="badge">{r.status.toUpperCase()}</span> · Position: {r.position}
          </p>

          {r.status === "pending" && (
            <div style={{ marginTop: "12px" }}>
              <RegistrationDecision id={r.id} revision={r.revision} />
            </div>
          )}

          {r.status === "approved" && (
            <p style={{ color: "var(--lime)" }}>
              Your league is available in My account. Team placement and game eligibility are managed separately.
            </p>
          )}

          {decisions.error ? (
            <p>Review history could not be loaded.</p>
          ) : (
            <ul>
              {decisions.data
                ?.filter((d) => d.registration_id === r.id)
                .map((d) => (
                  <li key={d.id}>
                    {d.new_status}: {d.reason}
                  </li>
                ))}
            </ul>
          )}

          {acceptances.error ? (
            <p>Document acceptance history could not be loaded.</p>
          ) : (
            <>
              <h4>Signed documents</h4>
              {acceptances.data
                ?.filter((a) => a.registration_id === r.id)
                .map((a) => (
                  <p key={a.id}>
                    {a.document_title} v{a.document_version} · {a.signer_name} · {a.accepted_at}
                  </p>
                ))}
            </>
          )}

          {consents.error ? (
            <p>Consent history could not be loaded.</p>
          ) : (
            <>
              <h4>Optional permissions</h4>
              {consents.data
                ?.filter((c) => c.registration_id === r.id)
                .map((c) => (
                  <p key={c.id}>
                    {c.consent_type.replace("_", " ")}: {c.granted ? "Yes" : "No"} · {c.consent_text}
                  </p>
                ))}
            </>
          )}
        </section>
      ))}
    </>
  );
}
