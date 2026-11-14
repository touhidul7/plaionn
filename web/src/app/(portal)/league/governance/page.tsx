import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface GovernanceRoleRow {
  role_id: string;
  user_id: string;
  email: string;
  governance_model: string;
  can_manage_finances: boolean;
  can_manage_schedules: boolean;
  can_manage_rosters: boolean;
  can_transfer_ownership: boolean;
  assigned_at: string;
}

export default async function LeagueGovernancePage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>Franchise Governance &amp; Staff Roles</h1>
        <p>Only league owners and commissioners may manage governance permissions.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch governance roles
  const { data: teamRes } = await supabase.rpc("get_league_governance_team", {
    target_league: league.id,
  });

  const roles: GovernanceRoleRow[] = teamRes?.governance_roles || [];

  async function assignRoleAction(formData: FormData) {
    "use server";
    const targetEmail = formData.get("email") as string;
    const model = formData.get("governanceModel") as string;
    const canFinances = formData.get("canFinances") === "on";
    const canSchedules = formData.get("canSchedules") === "on";
    const canRosters = formData.get("canRosters") === "on";

    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();

    // Find user by email in auth
    const { data: userData } = await actionClient
      .from("league_memberships")
      .select("user_id")
      .eq("league_id", actionLeague.id)
      .limit(1)
      .maybeSingle();

    if (userData?.user_id) {
      await actionClient.rpc("assign_governance_role", {
        target_league: actionLeague.id,
        target_user: userData.user_id,
        p_model: model,
        p_finances: canFinances,
        p_schedules: canSchedules,
        p_rosters: canRosters,
        p_transfer: false,
      });
    }
    revalidatePath("/league/governance");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GOVERNANCE &amp; DELEGATION</p>
          <h1>Franchise Governance &amp; Staff</h1>
          <p>{league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      <div className="section-heading">
        <h2>Appointed Operating Staff &amp; Directors</h2>
        <span>Granular role assignments for facility managers, schedulers, and directors</span>
      </div>

      <section className="panel" style={{ marginBottom: "2rem" }}>
        {roles.length === 0 ? (
          <div className="empty">
            <p>No auxiliary governance roles assigned yet.</p>
            <p className="hint">The league commissioner currently holds full operational oversight.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Governance Role</th>
                  <th>Schedules</th>
                  <th>Rosters</th>
                  <th>Finances</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.role_id}>
                    <td>
                      <strong>{r.email}</strong>
                    </td>
                    <td>
                      <span className="badge info">
                        {r.governance_model.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td>{r.can_manage_schedules ? "✓ Yes" : "✕ No"}</td>
                    <td>{r.can_manage_rosters ? "✓ Yes" : "✕ No"}</td>
                    <td>{r.can_manage_finances ? "✓ Yes" : "✕ No"}</td>
                    <td>{new Date(r.assigned_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="section-heading">
        <h2>Appoint Governance Role</h2>
        <span>Delegate operational tasks to facility directors or coordinators</span>
      </div>

      <section className="panel">
        <form action={assignRoleAction} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "520px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Member Email</label>
            <input
              type="email"
              name="email"
              placeholder="director@arena.com"
              required
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Governance Title</label>
            <select
              name="governanceModel"
              defaultValue="facility_director"
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            >
              <option value="facility_director">Facility Director / Rink Manager</option>
              <option value="operating_manager">Operating Manager</option>
              <option value="investor">Investor / Silent Partner</option>
              <option value="owner">Co-Owner</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" name="canSchedules" defaultChecked />
              <span>Can manage ice schedules and game times</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" name="canRosters" defaultChecked />
              <span>Can manage team rosters and player eligibility</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" name="canFinances" />
              <span>Can view and manage banking invoices and fee payouts</span>
            </label>
          </div>

          <button type="submit" className="button primary" style={{ alignSelf: "flex-start", marginTop: "8px" }}>
            Appoint Staff Member
          </button>
        </form>
      </section>
    </>
  );
}
