import Link from "next/link";
import { getVerifiedSession } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface ConsentItem {
  id: string;
  registration_id: string;
  consent_type: string;
  granted: boolean;
  consent_text: string;
  recorded_at: string;
  league_name?: string;
  season_name?: string;
}

export default async function AccountPrivacyPage() {
  const { supabase, user } = await getVerifiedSession();

  // Fetch Consents
  const { data: rawConsents } = await supabase
    .from("registration_consents")
    .select("id,registration_id,consent_type,granted,consent_text,recorded_at")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false });

  const consents: ConsentItem[] = rawConsents ?? [];

  async function handleWithdrawConsent(formData: FormData) {
    "use server";
    const session = await getVerifiedSession();
    const regId = String(formData.get("registration_id"));
    const consentType = String(formData.get("consent_type"));

    if (regId && consentType) {
      await session.supabase.rpc("withdraw_registration_consent", {
        p_registration_id: regId,
        p_consent_type: consentType,
      });
      revalidatePath("/account/privacy");
    }
  }

  async function handleExportData() {
    "use server";
    const session = await getVerifiedSession();
    const { data } = await session.supabase.rpc("export_my_player_data");
    return data;
  }

  async function handleAnonymization(formData: FormData) {
    "use server";
    const session = await getVerifiedSession();
    const conf = String(formData.get("confirmation") ?? "").trim();
    if (conf.toLowerCase() === "anonymize my data") {
      await session.supabase.rpc("anonymize_my_player_profile", {
        p_confirmation: conf,
      });
      revalidatePath("/account/privacy");
      revalidatePath("/account");
    }
  }

  return (
    <main id="main" className="public-portal-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRIVACY &amp; DATA CONTROL</p>
          <h1>Your Data Rights &amp; Privacy</h1>
          <p>{user.email} · Transparency, consent revocation, and data exports</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link className="button" href="/account">
            ← Account Settings
          </Link>
          <Link className="button" href="/dashboard">
            Player Hub ↗
          </Link>
        </div>
      </div>

      {/* 1. Download Personal Data Export */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>📦 Personal Data Export (Right to Portability)</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Download a complete, machine-readable record of your player profile, season registrations, signed waivers,
          match attendance entries, and communication preferences.
        </p>

        <form action={handleExportData}>
          <button
            type="submit"
            className="button primary"
            style={{ padding: "10px 22px" }}
          >
            Download Personal Data Archive (JSON) →
          </button>
        </form>
      </section>

      {/* 2. Optional Permissions & Consent Revocation */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>🛡️ Active Permissions &amp; Consent Revocation</h2>
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          You can revoke optional permissions (public directory listing, filming, or marketing updates) at any time.
        </p>

        {consents.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No optional permissions recorded for your registrations.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {consents.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "14px 18px",
                  background: "#0c1822",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "0.95rem", textTransform: "capitalize" }}>
                      {c.consent_type.replace(/_/g, " ")}
                    </strong>
                    <span
                      className="badge"
                      style={{
                        fontSize: "0.7rem",
                        background: c.granted ? "#1e3a2b" : "#3a1e1e",
                        color: c.granted ? "var(--lime)" : "#fca5a5",
                      }}
                    >
                      {c.granted ? "ACTIVE PERMISSION" : "REVOKED"}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: 0 }}>
                    {c.consent_text}
                  </p>
                </div>

                {c.granted && (
                  <form action={handleWithdrawConsent}>
                    <input type="hidden" name="registration_id" value={c.registration_id} />
                    <input type="hidden" name="consent_type" value={c.consent_type} />
                    <button
                      type="submit"
                      className="button button-danger"
                      style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                    >
                      Revoke Permission
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Account Redaction / Right to be Forgotten */}
      <section className="panel" style={{ border: "1px solid #7f1d1d" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", color: "#fca5a5" }}>
          ⚠️ Account Anonymization &amp; Data Redaction
        </h2>
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1rem" }}>
          In compliance with privacy standards, you can request full personal data redaction. Your name will be
          replaced with &quot;Redacted Player&quot;, phone and notification settings purged, and active rosters retired.
          Historical game sheet records and team standings remain preserved for competitive fairness.
        </p>

        <form action={handleAnonymization} className="form-stack">
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Type <strong>anonymize my data</strong> to confirm:
            </span>
            <input
              name="confirmation"
              required
              placeholder="anonymize my data"
              style={{ maxWidth: "340px" }}
            />
          </label>

          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="submit"
              className="button button-danger"
              style={{ padding: "10px 22px" }}
            >
              Confirm Account Redaction
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
