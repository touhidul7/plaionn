import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { OfficialRateCardForm, MarkPaidForm } from "@/components/officials-payroll-forms";

export const dynamic = "force-dynamic";

interface PayrollSummaryRow {
  user_id: string;
  full_name: string;
  certification_level: string;
  total_games: number;
  referee_games: number;
  timekeeper_games: number;
  total_earned_cents: number;
  pending_cents: number;
  paid_cents: number;
}

export default async function OfficialsPayrollPage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>Officials &amp; Payroll Management</h1>
        <p>Only league commissioners may view and manage official payroll and rate cards.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch officials payroll summary and eligible members
  const [payrollRes, membersRes] = await Promise.all([
    supabase.rpc("get_officials_payroll_summary", {
      target_league: league.id,
    }),
    supabase
      .from("league_memberships")
      .select("user_id,role")
      .eq("league_id", league.id)
      .in("role", ["referee", "timekeeper"]),
  ]);

  const payrollRows = (!payrollRes.error && Array.isArray(payrollRes.data)
    ? payrollRes.data
    : []) as PayrollSummaryRow[];

  const availableMembers = (membersRes.data || []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
  }));

  const totalEarnedCents = payrollRows.reduce((sum, r) => sum + (r.total_earned_cents || 0), 0);
  const totalPendingCents = payrollRows.reduce((sum, r) => sum + (r.pending_cents || 0), 0);
  const totalPaidCents = payrollRows.reduce((sum, r) => sum + (r.paid_cents || 0), 0);
  const totalGamesWorked = payrollRows.reduce((sum, r) => sum + (r.total_games || 0), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEAGUE OPERATIONS</p>
          <h1>Officials &amp; Payroll Ledger</h1>
          <p>{league.name} · Certifications, fee rates, and compensation tracking</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <a
            className="button primary"
            href={`/api/payroll/export?leagueId=${league.id}`}
            download={`payroll-${league.id}.csv`}
            title="Download payroll spreadsheet for accounting"
          >
            📥 Export Payroll (CSV)
          </a>
          <Link className="button" href="/league">
            League HQ
          </Link>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="metrics" style={{ marginBottom: "2rem" }}>
        {[
          [`$${(totalEarnedCents / 100).toFixed(2)}`, "Total Compensation", "Accrued referee & timekeeper fees"],
          [`$${(totalPendingCents / 100).toFixed(2)}`, "Pending Payouts", "Outstanding balance to disburse"],
          [`$${(totalPaidCents / 100).toFixed(2)}`, "Total Paid Out", "Completed payments with references"],
          [totalGamesWorked, "Games Officiated", "Assignments completed"],
        ].map(([value, label, caption]) => (
          <article key={label as string} className="panel">
            <p>{label}</p>
            <p className="metric">{value}</p>
            <p>{caption}</p>
          </article>
        ))}
      </div>

      {/* Payroll Summary Table */}
      <section className="panel" style={{ marginBottom: "2rem" }}>
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>Officials Payout Ledger</h2>
          <span className="badge">{payrollRows.length} Registered Officials</span>
        </div>

        {payrollRows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Official</th>
                  <th scope="col">Certification</th>
                  <th scope="col">Total Games</th>
                  <th scope="col">Ref / TK Split</th>
                  <th scope="col">Total Earned</th>
                  <th scope="col">Pending</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {payrollRows.map((row) => {
                  const pendingDollars = ((row.pending_cents || 0) / 100).toFixed(2);
                  const earnedDollars = ((row.total_earned_cents || 0) / 100).toFixed(2);

                  return (
                    <tr key={row.user_id}>
                      <td>
                        <strong>{row.full_name}</strong>
                      </td>
                      <td>
                        <span className="badge">{row.certification_level}</span>
                      </td>
                      <td>{row.total_games}</td>
                      <td>
                        {row.referee_games} Ref / {row.timekeeper_games} TK
                      </td>
                      <td>
                        <strong style={{ color: "var(--text)" }}>${earnedDollars}</strong>
                      </td>
                      <td>
                        <span style={{ color: row.pending_cents > 0 ? "var(--lime)" : "var(--muted)", fontWeight: 700 }}>
                          ${pendingDollars}
                        </span>
                      </td>
                      <td>
                        {row.pending_cents > 0 ? (
                          <MarkPaidForm
                            userId={row.user_id}
                            officialName={row.full_name}
                            pendingDollars={pendingDollars}
                          />
                        ) : (
                          <span className="badge" style={{ background: "#1a382a", color: "var(--lime)" }}>
                            All Paid ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            No official profiles created yet. Configure rate cards below to track compensation automatically.
          </p>
        )}
      </section>

      {/* Official Rate Card Configuration */}
      <OfficialRateCardForm availableMembers={availableMembers} />
    </>
  );
}
