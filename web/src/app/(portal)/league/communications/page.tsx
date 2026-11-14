import Link from "next/link";
import { getVerifiedSession } from "@/lib/supabase/session";
import { getLeagueData } from "@/lib/league";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

interface DeliveryLogItem {
  delivery_id: string;
  recipient_email: string;
  recipient_user_id: string;
  category: string;
  channel: string;
  title: string;
  message: string;
  target_url?: string;
  status: string;
  sent_at?: string;
  created_at: string;
}

export default async function LeagueCommunicationsPage() {
  const data = await getLeagueData();
  const { league, canManage } = data;
  const { supabase } = await getVerifiedSession();

  if (!canManage) {
    return (
      <section className="panel">
        <h1>Access Restricted</h1>
        <p>Commissioner privileges are required to access League Communications.</p>
        <Link className="button" href="/league">
          Back to League HQ
        </Link>
      </section>
    );
  }

  // Fetch Delivery Logs
  const { data: logsData } = await supabase.rpc("get_league_delivery_logs", {
    target_league: league.id,
    limit_count: 50,
  });

  const logs: DeliveryLogItem[] = logsData ?? [];

  // Summary Metrics
  const totalDispatches = logs.length;
  const deliveredCount = logs.filter((l) => l.status === "delivered").length;
  const quietHoursCount = logs.filter((l) => l.status === "suppressed_quiet_hours").length;
  const smsCount = logs.filter((l) => l.channel === "sms").length;

  async function handleBroadcastAction(formData: FormData) {
    "use server";
    const session = await getVerifiedSession();
    const scope = String(formData.get("scope") ?? "all_league");
    const category = String(formData.get("category") ?? "announcement");
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const targetUrl = String(formData.get("target_url") ?? "").trim();

    if (!title || !message) return;

    await session.supabase.rpc("broadcast_league_notification", {
      target_league: league.id,
      target_scope: scope,
      target_scope_id: null,
      notif_category: category,
      notif_title: title,
      notif_message: message,
      notif_url: targetUrl || null,
    });

    revalidatePath("/league/communications");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNICATIONS &amp; BROADCASTS</p>
          <h1>Messaging Hub &amp; Delivery Ledger</h1>
          <p>{league.name} · Real-time multi-channel delivery audit</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link className="button" href="/league">
            ← League HQ
          </Link>
          <Link className="button" href="/account/notifications">
            Personal Preferences ↗
          </Link>
        </div>
      </div>

      {/* Overview Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="panel" style={{ padding: "18px", background: "#0c1822" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>RECENT DISPATCHES</span>
          <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "var(--text)" }}>
            {totalDispatches}
          </p>
        </div>
        <div className="panel" style={{ padding: "18px", background: "#0c1822" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>SUCCESSFULLY DELIVERED</span>
          <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "var(--lime)" }}>
            {deliveredCount}
          </p>
        </div>
        <div className="panel" style={{ padding: "18px", background: "#0c1822" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>QUIET HOURS HELD</span>
          <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#f59e0b" }}>
            {quietHoursCount}
          </p>
        </div>
        <div className="panel" style={{ padding: "18px", background: "#0c1822" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>SMS TEXT ALERTS</span>
          <p style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "4px 0 0 0", color: "#66d6e9" }}>
            {smsCount}
          </p>
        </div>
      </div>

      {/* Broadcast Dispatcher Form */}
      <section className="panel" style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>📢 Broadcast League Notification</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1.25rem" }}>
          Send automated notifications to members respecting their delivery channel choices and quiet hours.
        </p>

        <form action={handleBroadcastAction} className="form-stack">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span>Target Audience</span>
              <select name="scope" defaultValue="all_league">
                <option value="all_league">All Registered League Members</option>
                <option value="division">Active Division Rosters</option>
                <option value="team">Team Captains &amp; Players</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: "6px" }}>
              <span>Category</span>
              <select name="category" defaultValue="announcement">
                <option value="announcement">General League Announcement</option>
                <option value="game_reminder">Upcoming Match Reminder</option>
                <option value="schedule_change">Schedule / Rink Change Alert</option>
                <option value="spare_callup">Emergency Goalie / Spare Callup</option>
                <option value="discipline">Discipline &amp; Safety Notice</option>
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: "6px" }}>
            <span>Broadcast Headline</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. Schedule Update: Rink 2 maintenance scheduled for Friday"
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span>Detailed Message Body</span>
            <textarea
              name="message"
              required
              rows={3}
              placeholder="Write message content here. Links will be formatted automatically..."
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span>Action URL (Optional)</span>
            <input
              name="target_url"
              placeholder="/schedule or /announcements"
            />
          </label>

          <div style={{ marginTop: "0.5rem" }}>
            <button type="submit" className="button primary" style={{ padding: "10px 24px" }}>
              Dispatch Multi-Channel Broadcast →
            </button>
          </div>
        </form>
      </section>

      {/* Real-time Delivery Ledger */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Notification Delivery Audit Trail</h2>
          <span className="badge" style={{ fontSize: "0.75rem" }}>
            Last 50 Entries
          </span>
        </div>

        {logs.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No notification dispatches recorded yet in this league.</p>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Channel</th>
                  <th>Category</th>
                  <th>Title &amp; Message</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.delivery_id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{log.recipient_email}</span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          textTransform: "uppercase",
                          fontSize: "0.7rem",
                          background:
                            log.channel === "sms"
                              ? "#1e3a4b"
                              : log.channel === "push"
                              ? "#2e1e4b"
                              : "#1e3a2b",
                          color:
                            log.channel === "sms"
                              ? "#66d6e9"
                              : log.channel === "push"
                              ? "#c084fc"
                              : "var(--lime)",
                        }}
                      >
                        {log.channel}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {log.category.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ maxWidth: "340px" }}>
                      <strong style={{ fontSize: "0.85rem", display: "block" }}>{log.title}</strong>
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.message}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: "0.7rem",
                          background:
                            log.status === "delivered"
                              ? "#1e3a2b"
                              : log.status === "suppressed_quiet_hours"
                              ? "#3a321e"
                              : "#3a1e1e",
                          color:
                            log.status === "delivered"
                              ? "var(--lime)"
                              : log.status === "suppressed_quiet_hours"
                              ? "#fde047"
                              : "#fca5a5",
                        }}
                      >
                        {log.status === "suppressed_quiet_hours" ? "QUIET HOURS" : log.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ·{" "}
                      {new Date(log.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
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
