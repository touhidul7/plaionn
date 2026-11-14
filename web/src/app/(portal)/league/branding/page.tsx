import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface BrandingProfile {
  id?: string;
  brand_name?: string;
  custom_domain?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url?: string;
  hero_headline?: string;
  hero_subheadline?: string;
}

interface PlatformBilling {
  plan_code: string;
  plan_name: string;
  status: string;
  billing_cycle: string;
  base_price_cents: number;
  per_team_fee_cents: number;
  active_team_count: number;
  total_cycle_fee_cents: number;
  features: {
    max_teams: number;
    video_streaming: boolean;
    custom_domain: boolean;
  };
}

export default async function LeagueBrandingPage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>League Branding &amp; Custom Domain</h1>
        <p>Only league commissioners may configure white-label branding and domain routing.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch branding and platform billing
  const [brandingRes, billingRes] = await Promise.all([
    supabase
      .from("league_branding_profiles")
      .select("*")
      .eq("league_id", league.id)
      .maybeSingle(),
    supabase.rpc("get_league_platform_billing", {
      target_league: league.id,
    }),
  ]);

  const branding: BrandingProfile = brandingRes.data || {
    primary_color: "#0f172a",
    secondary_color: "#10b981",
    accent_color: "#f59e0b",
  };

  const billing: PlatformBilling = billingRes.data || {
    plan_code: "community",
    plan_name: "Community Tier",
    status: "active",
    billing_cycle: "monthly",
    base_price_cents: 0,
    per_team_fee_cents: 0,
    active_team_count: 0,
    total_cycle_fee_cents: 0,
    features: {
      max_teams: 8,
      video_streaming: false,
      custom_domain: false,
    },
  };

  async function updateBrandingAction(formData: FormData) {
    "use server";
    const brandName = formData.get("brandName") as string;
    const customDomain = formData.get("customDomain") as string;
    const primaryColor = formData.get("primaryColor") as string;
    const secondaryColor = formData.get("secondaryColor") as string;
    const logoUrl = formData.get("logoUrl") as string;
    const heroHeadline = formData.get("heroHeadline") as string;

    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();
    await actionClient.rpc("update_league_branding", {
      target_league: actionLeague.id,
      p_brand_name: brandName,
      p_custom_domain: customDomain,
      p_primary_color: primaryColor,
      p_secondary_color: secondaryColor,
      p_logo_url: logoUrl,
      p_hero_headline: heroHeadline,
    });
    revalidatePath("/league/branding");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WHITE-LABEL &amp; DOMAIN</p>
          <h1>League Identity &amp; Platform Plan</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      <div className="metrics-grid" style={{ marginBottom: "2rem" }}>
        <div className="metric-card">
          <p className="metric-label">CURRENT PLATFORM PLAN</p>
          <p className="metric-value">{billing.plan_name}</p>
          <span className="metric-detail">Status: {billing.status.toUpperCase()}</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">ACTIVE TEAMS</p>
          <p className="metric-value">
            {billing.active_team_count} / {billing.features.max_teams}
          </p>
          <span className="metric-detail">Included team capacity</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">CUSTOM DOMAIN</p>
          <p className="metric-value">
            {branding.custom_domain || "Not Connected"}
          </p>
          <span className="metric-detail">
            {billing.features.custom_domain ? "✓ Entitlement Active" : "Upgrade required"}
          </span>
        </div>
      </div>

      <div className="section-heading">
        <h2>White-Label Customization</h2>
        <span>Personalize colors, custom domain name, and league banners</span>
      </div>

      <section className="panel">
        <form action={updateBrandingAction} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "600px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Brand Name</label>
            <input
              type="text"
              name="brandName"
              defaultValue={branding.brand_name || league.name}
              required
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Custom Domain (CNAME / Vanity URL)</label>
            <input
              type="text"
              name="customDomain"
              defaultValue={branding.custom_domain || ""}
              placeholder="e.g. wahlhockey.ca or league.yourdomain.com"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
            <span className="hint">Direct your DNS CNAME record to the Plaionn network edge.</span>
          </div>

          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Primary Color</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="color"
                  name="primaryColor"
                  defaultValue={branding.primary_color || "#0f172a"}
                  style={{ width: "44px", height: "36px", padding: "0", border: "none", cursor: "pointer" }}
                />
                <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{branding.primary_color}</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Secondary / Accent</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="color"
                  name="secondaryColor"
                  defaultValue={branding.secondary_color || "#10b981"}
                  style={{ width: "44px", height: "36px", padding: "0", border: "none", cursor: "pointer" }}
                />
                <span style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{branding.secondary_color}</span>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Logo Image URL</label>
            <input
              type="url"
              name="logoUrl"
              defaultValue={branding.logo_url || ""}
              placeholder="https://yourdomain.com/logo.png"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Hero Banner Headline</label>
            <input
              type="text"
              name="heroHeadline"
              defaultValue={branding.hero_headline || ""}
              placeholder="e.g. Western Adult Hockey League - 2026 Season"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <button type="submit" className="button primary" style={{ alignSelf: "flex-start", marginTop: "8px" }}>
            Save Branding Settings
          </button>
        </form>
      </section>
    </>
  );
}
