import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeagueContext } from "@/lib/supabase/session";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";

export const dynamic = "force-dynamic";

interface InboxItem {
  delivery_id: string;
  category: string;
  channel: string;
  title: string;
  message: string;
  target_url: string | null;
  status: string;
  created_at: string;
}

export default async function AccountNotificationsPage() {
  const { supabase, league, user } = await getLeagueContext();
  if (!user) redirect("/login");

  const [prefsRes, inboxRes] = await Promise.all([
    supabase.rpc("get_user_notification_preferences", {
      target_league: league.id,
    }),
    supabase.rpc("get_notification_inbox", {
      target_league: league.id,
      limit_count: 10,
    }),
  ]);

  const prefs = prefsRes.data?.[0] || {
    phone_number: null,
    sms_enabled: false,
    push_enabled: true,
    email_enabled: true,
    notify_game_reminders: true,
    notify_schedule_changes: true,
    notify_spare_callups: true,
    notify_announcements: true,
    notify_discipline: true,
    quiet_hours_enabled: true,
    quiet_hours_start: "22:00:00",
    quiet_hours_end: "08:00:00",
    time_zone: "America/Toronto",
  };

  const inbox = (!inboxRes.error && Array.isArray(inboxRes.data)
    ? inboxRes.data
    : []) as InboxItem[];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Notifications &amp; SMS Alerts</h1>
          <p>{user.email} · {league.name}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href="/account">
            ← Account Overview
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: "2.5rem" }}>
        <NotificationPreferencesForm initialPrefs={prefs} />

        {/* Recent Alerts Inbox */}
        <section className="panel">
          <div className="section-heading" style={{ marginTop: 0 }}>
            <h2>📬 Recent Notification Activity</h2>
            <span className="badge">{inbox.length} Recent Alerts</span>
          </div>

          {inbox.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Category</th>
                    <th scope="col">Channel</th>
                    <th scope="col">Alert Details</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.map((item) => (
                    <tr key={item.delivery_id}>
                      <td>
                        <time dateTime={item.created_at}>
                          {new Intl.DateTimeFormat("en-CA", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(item.created_at))}
                        </time>
                      </td>
                      <td>
                        <span className="badge">{item.category.replace(/_/g, " ").toUpperCase()}</span>
                      </td>
                      <td>{item.channel.toUpperCase()}</td>
                      <td>
                        <strong>{item.title}</strong>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                          {item.message}
                        </p>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              item.status === "delivered"
                                ? "#1a382a"
                                : item.status === "suppressed_quiet_hours"
                                ? "#382a10"
                                : "#1a2e38",
                            color:
                              item.status === "delivered"
                                ? "var(--lime)"
                                : item.status === "suppressed_quiet_hours"
                                ? "#facc15"
                                : "var(--text)",
                          }}
                        >
                          {item.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No notifications received yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
