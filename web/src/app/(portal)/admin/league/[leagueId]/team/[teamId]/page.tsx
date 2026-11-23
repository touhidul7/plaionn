import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>;
}) {
  const { leagueId, teamId } = await params;
  const { league, user, canManage } = await getLeagueContext();

  // Seeded / fallback roster members for this team
  const samplePlayers = [
    { id: "p-1", name: "Nathan Cole", number: 30, position: "G", waiver: "Signed", fee: "Paid" },
    { id: "p-2", name: "Marcus Vance", number: 19, position: "F", waiver: "Signed", fee: "Paid" },
    { id: "p-3", name: "Alex Mercer", number: 8, position: "D", waiver: "Signed", fee: "Paid" },
    { id: "p-4", name: "David Chen", number: 91, position: "F", waiver: "Signed", fee: "Paid" },
    { id: "p-5", name: "Erik Lindqvist", number: 4, position: "D", waiver: "Pending", fee: "Outstanding" },
  ];

  return (
    <main id="main" className="public-portal-container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href={`/admin/league/${leagueId}`}
            className="button button-sm button-outline"
            style={{ fontSize: "12px", fontWeight: 700 }}
          >
            ← Back to League Backend
          </Link>
          <span className="badge" style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontSize: "11px" }}>
            OFFICIAL TEAM PROFILE
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link
            href={`/teams/${teamId}`}
            target="_blank"
            className="button button-sm button-outline"
            style={{ fontSize: "11.5px" }}
          >
            Public Fan Page ↗
          </Link>
        </div>
      </div>

      {/* Team Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Team Details</span>
          <h2 style={{ margin: "4px 0 0", fontSize: "20px", color: "var(--text)" }}>Team Dashboard</h2>
          <span style={{ fontSize: "12px", color: "var(--lime)" }}>ID: {teamId}</span>
        </div>
        <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Roster Count</span>
          <div style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 900, color: "var(--lime)" }}>{samplePlayers.length} Active Players</div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Verified eligibility</span>
        </div>
        <div style={{ background: "#0c1822", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Fee Status</span>
          <div style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: 900, color: "#10b981" }}>
            $1,200 / $1,200
          </div>
          <span className="badge" style={{ fontSize: "10px", marginTop: "2px" }}>PAID IN FULL</span>
        </div>
      </div>

      {/* Roster Table */}
      <section className="panel" style={{ padding: "24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: "17px" }}>Registered Players &amp; Liability Waivers</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Player Name</th>
                <th>Position</th>
                <th>Registration</th>
                <th>Waiver Status</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {samplePlayers.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 800, color: "var(--lime)" }}>#{p.number}</td>
                  <td style={{ fontWeight: 700, color: "var(--text)" }}>{p.name}</td>
                  <td><span className="badge" style={{ fontSize: "10px" }}>{p.position}</span></td>
                  <td>
                    <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontSize: "10.5px" }}>
                      ✓ Registered
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: p.waiver === "Signed" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: p.waiver === "Signed" ? "#10b981" : "#ef4444",
                        fontSize: "10.5px",
                      }}
                    >
                      {p.waiver}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: p.fee === "Paid" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: p.fee === "Paid" ? "#10b981" : "#f59e0b",
                        fontSize: "10.5px",
                      }}
                    >
                      {p.fee}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
