import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface StaffRow {
  user_id: string;
  email: string;
  role: string;
}

export default async function LeagueGovernancePage() {
  const { supabase, league, user, canManage } = await getLeagueContext();
  if (!user) redirect("/login");
  if (!canManage) {
    return (
      <section className="panel empty">
        <h1>League Governance &amp; Staff Roles</h1>
        <p>Only league commissioners may manage administrator and staff roles.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch all staff & commissioners
  const { data: staffData, error: staffError } = await supabase.rpc("get_league_staff_members", {
    target_league: league.id,
  });

  const staffList: StaffRow[] = (!staffError && staffData) ? staffData : [];

  // Server Action: Add Admin / Staff by email
  async function addStaffAction(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string)?.trim();
    const role = (formData.get("role") as string) || "commissioner";

    if (!email) return;

    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();

    await actionClient.rpc("add_league_member_by_email", {
      target_league: actionLeague.id,
      target_email: email,
      target_role: role,
    });

    revalidatePath("/league/governance");
  }

  // Server Action: Remove Admin / Staff
  async function removeStaffAction(formData: FormData) {
    "use server";
    const targetUserId = formData.get("userId") as string;
    const targetRole = formData.get("role") as string;

    if (!targetUserId || !targetRole) return;

    const { supabase: actionClient, league: actionLeague } = await getLeagueContext();

    await actionClient.rpc("remove_league_member", {
      target_league: actionLeague.id,
      target_user: targetUserId,
      target_role: targetRole,
    });

    revalidatePath("/league/governance");
  }

  const roleLabels: Record<string, string> = {
    commissioner: "Commissioner (Full Administrator)",
    referee: "Referee (Scoresheet Approval)",
    timekeeper: "Timekeeper (Scorekeeping Console)",
    finance: "Finance Operator",
    media: "Media Manager",
    captain: "Team Captain",
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GOVERNANCE &amp; STAFF</p>
          <h1>Administrators &amp; Staff Management</h1>
          <p>{league.name} · Appoint and manage league operational roles</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/league" className="button">
            ← League HQ
          </Link>
        </div>
      </div>

      {/* 1. Active Administrators & Staff */}
      <div className="section-heading">
        <h2>Active League Administrators &amp; Staff</h2>
        <span>Commissioners and staff members with access to this league</span>
      </div>

      <section className="panel" style={{ marginBottom: "24px" }}>
        {staffList.length === 0 ? (
          <div className="empty">
            <p>No auxiliary administrators assigned yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Assigned Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((m) => {
                  const isCurrentUser = m.user_id === user.id;
                  const isSoleCommissioner =
                    m.role === "commissioner" &&
                    staffList.filter((s) => s.role === "commissioner").length <= 1;

                  return (
                    <tr key={`${m.user_id}-${m.role}`}>
                      <td>
                        <strong>{m.email}</strong>
                        {isCurrentUser && (
                          <span className="badge" style={{ marginLeft: "8px", background: "rgba(199,244,80,0.15)", color: "var(--lime)" }}>
                            You
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: m.role === "commissioner" ? "#23372b" : "#1a2e38", color: m.role === "commissioner" ? "var(--lime)" : "var(--text)" }}>
                          {roleLabels[m.role] || m.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {isSoleCommissioner ? (
                          <small style={{ color: "var(--muted)" }}>Sole Commissioner</small>
                        ) : (
                          <form action={removeStaffAction} style={{ margin: 0 }}>
                            <input type="hidden" name="userId" value={m.user_id} />
                            <input type="hidden" name="role" value={m.role} />
                            <button
                              type="submit"
                              className="button button-sm button-danger"
                              title="Revoke access"
                            >
                              Remove
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Add Administrator or Staff Member */}
      <div className="section-heading">
        <h2>Appoint New Administrator or Staff Member</h2>
        <span>Grant commissioner, referee, timekeeper, or finance permissions by email</span>
      </div>

      <section className="panel">
        <form action={addStaffAction} className="form-stack" style={{ maxWidth: "540px" }}>
          <label>
            User Email Address
            <input
              type="email"
              name="email"
              placeholder="e.g. colleague@league.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            Assigned Operational Role
            <select name="role" defaultValue="commissioner">
              <option value="commissioner">Commissioner (Full League Administrator Access)</option>
              <option value="referee">Referee (Scoresheet Approval &amp; Game Verification)</option>
              <option value="timekeeper">Timekeeper (Rink Scorekeeping Console)</option>
              <option value="finance">Finance Operator (Billing &amp; Payment Settlements)</option>
              <option value="media">Media Manager (Game Video &amp; Highlight Reels)</option>
            </select>
          </label>

          <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
            The person must already have an account on the platform (or sign up at <code>/login</code>). Once you appoint their email address, they will immediately have administrator access when signed in.
          </p>

          <button type="submit" className="button primary">
            Appoint Administrator →
          </button>
        </form>
      </section>
    </>
  );
}
