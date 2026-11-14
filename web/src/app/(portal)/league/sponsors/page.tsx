import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

interface SponsorRow {
  sponsor_id: string;
  name: string;
  tier: string;
  url: string;
  is_active: boolean;
  impressions: number;
  clicks: number;
  ctr_pct: number;
}

interface CampaignReport {
  total_impressions: number;
  total_clicks: number;
  overall_ctr_pct: number;
  sponsors: SponsorRow[];
}

export default async function SponsorsAnalyticsPage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>Sponsor Campaigns &amp; Analytics</h1>
        <p>Only league commissioners may view sponsorship ROI and campaign reports.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  const { data: rawReport } = await supabase.rpc("get_sponsor_campaign_report", {
    target_league: league.id,
  });

  const report: CampaignReport = rawReport || {
    total_impressions: 0,
    total_clicks: 0,
    overall_ctr_pct: 0,
    sponsors: [],
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMERCIAL &amp; PARTNERSHIPS</p>
          <h1>Sponsor Campaigns &amp; ROI</h1>
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
          <p className="metric-label">TOTAL IMPRESSIONS</p>
          <p className="metric-value">{report.total_impressions.toLocaleString()}</p>
          <span className="metric-detail">Scoreboard and portal banner views</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">TOTAL CLICKS</p>
          <p className="metric-value">{report.total_clicks.toLocaleString()}</p>
          <span className="metric-detail">Direct sponsor website referrals</span>
        </div>
        <div className="metric-card">
          <p className="metric-label">AVERAGE CTR</p>
          <p className="metric-value">{report.overall_ctr_pct}%</p>
          <span className="metric-detail">Click-through performance</span>
        </div>
      </div>

      <div className="section-heading">
        <h2>Partner Campaign Performance</h2>
        <span>Detailed engagement metrics by partner and tier placement</span>
      </div>

      <section className="panel">
        {report.sponsors.length === 0 ? (
          <div className="empty">
            <p>No active sponsors configured yet.</p>
            <p className="hint">Sponsors added to your league banner automatically track views and clicks here.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Tier</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {report.sponsors.map((s) => (
                  <tr key={s.sponsor_id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>
                      <span className="badge info">{s.tier.replace("_", " ").toUpperCase()}</span>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {s.impressions.toLocaleString()}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {s.clicks.toLocaleString()}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      <strong>{s.ctr_pct}%</strong>
                    </td>
                    <td>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.85rem", color: "#3b82f6" }}
                        >
                          Visit Link ↗
                        </a>
                      ) : (
                        <span className="hint">No link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
