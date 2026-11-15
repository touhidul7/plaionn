import Link from "next/link";
import { getLeagueData } from "@/lib/league";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const { teams, canManage, league } = await getLeagueData();

  return (
    <>
      <div className="page-heading" style={{ marginBottom: "28px" }}>
        <div>
          <span className="badge" style={{ marginBottom: "8px" }}>
            OFFICIAL CLUBS &amp; DIRECTORY
          </span>
          <h1 style={{ fontSize: "28px", margin: "4px 0 6px" }}>Team Pages</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>
            {league.name} · Official member clubs, active rosters, and division alignment.
          </p>
        </div>
        {canManage && (
          <Link className="button primary" href="/league">
            + Add a Team ↗
          </Link>
        )}
      </div>

      {teams.length === 0 ? (
        <section className="panel empty" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>♧</div>
          <h2 style={{ fontSize: "20px", margin: "0 0 8px" }}>No teams registered yet.</h2>
          <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>
            Create a season and division in League HQ, then register active teams.
          </p>
          {canManage && (
            <Link className="button primary" href="/league">
              Open League HQ →
            </Link>
          )}
        </section>
      ) : (
        <>
          {/* 1. Visual Team Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "20px",
              marginBottom: "36px",
            }}
          >
            {teams.map((t) => {
              const initials = t.name
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 3);

              return (
                <div
                  key={t.entry_id}
                  className="panel"
                  style={{
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    marginBottom: 0,
                    position: "relative",
                    overflow: "hidden",
                    borderTop: "3px solid var(--lime)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "#162734",
                        border: "1px solid var(--line)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: "17px",
                        color: "var(--lime)",
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontSize: "19px", margin: "0 0 3px", color: "var(--text)" }}>
                        {t.name}
                      </h2>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {t.division_name} · {t.season_name}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "12px",
                      color: "var(--muted)",
                      padding: "8px 12px",
                      background: "#0c1822",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <span>● Verified Member Club</span>
                    <span style={{ marginLeft: "auto", color: "var(--lime)", fontWeight: 700 }}>
                      Official Entry
                    </span>
                  </div>

                  <div style={{ marginTop: "auto", paddingTop: "4px" }}>
                    <Link
                      href={`/teams/${t.entry_id}`}
                      className="button button-sm primary"
                      style={{ width: "100%", justifyContent: "center", padding: "10px" }}
                    >
                      View Team &amp; Roster →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Compact Overview Table */}
          <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ margin: 0, fontSize: "15px" }}>All League Team Entries</h3>
            </div>
            <div className="table-wrap" style={{ margin: 0 }}>
              <table className="table" style={{ width: "100%", margin: 0 }}>
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Season</th>
                    <th scope="col">Division</th>
                    <th scope="col" style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.entry_id}>
                      <td style={{ fontWeight: 800 }}>
                        <Link href={`/teams/${t.entry_id}`} className="text-link">
                          {t.name}
                        </Link>
                      </td>
                      <td>{t.season_name}</td>
                      <td>
                        <span className="badge" style={{ fontSize: "10.5px" }}>
                          {t.division_name}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          className="button button-sm button-outline"
                          href={`/teams/${t.entry_id}`}
                          style={{ fontSize: "11.5px", padding: "4px 12px" }}
                        >
                          View Roster →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
