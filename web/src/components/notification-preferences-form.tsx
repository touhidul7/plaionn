"use client";

import { useActionState } from "react";
import { savePreferencesAction, type NotifState } from "@/app/(portal)/account/notifications/actions";

interface PrefsData {
  phone_number: string | null;
  sms_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  notify_game_reminders: boolean;
  notify_schedule_changes: boolean;
  notify_spare_callups: boolean;
  notify_announcements: boolean;
  notify_discipline: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  time_zone: string;
}

const initialState: NotifState = { status: "idle" };

export function NotificationPreferencesForm({ initialPrefs }: { initialPrefs: PrefsData }) {
  const [state, formAction, isPending] = useActionState(savePreferencesAction, initialState);

  return (
    <form action={formAction} style={{ display: "grid", gap: "2rem" }}>
      {state.status === "error" && (
        <div className="notice" role="alert" style={{ borderColor: "#ef4444", color: "#fca5a5" }}>
          {state.message}
        </div>
      )}
      {state.status === "success" && (
        <div className="notice" role="status" style={{ borderColor: "var(--lime)", color: "var(--lime)" }}>
          {state.message}
        </div>
      )}

      {/* Delivery Channels & Phone */}
      <section className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>📱 Delivery Channels</h2>
          <span className="badge">SMS &amp; Push</span>
        </div>

        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)", maxWidth: "320px" }}>
            Mobile Phone Number (for SMS Alerts)
            <input
              type="tel"
              name="phone"
              defaultValue={initialPrefs.phone_number || ""}
              placeholder="+1 555 123 4567"
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>

          <div style={{ display: "grid", gap: "10px", marginTop: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" name="smsOn" defaultChecked={initialPrefs.sms_enabled} style={{ width: "16px", height: "16px" }} />
              <span>Enable SMS Text Alerts (Urgent reminders &amp; emergency goalie alerts)</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" name="pushOn" defaultChecked={initialPrefs.push_enabled} style={{ width: "16px", height: "16px" }} />
              <span>Enable Web Push Notifications (Phone / Browser alerts)</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" name="emailOn" defaultChecked={initialPrefs.email_enabled} style={{ width: "16px", height: "16px" }} />
              <span>Enable Email Notifications</span>
            </label>
          </div>
        </div>
      </section>

      {/* Notification Categories */}
      <section className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>🔔 Notification Categories</h2>
          <span className="badge">Custom Opt-in</span>
        </div>

        <div style={{ display: "grid", gap: "12px", marginTop: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" name="remindersOn" defaultChecked={initialPrefs.notify_game_reminders} style={{ width: "16px", height: "16px" }} />
            <span>🏒 Game Day Reminders &amp; RSVP Check-in Prompts</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" name="schedOn" defaultChecked={initialPrefs.notify_schedule_changes} style={{ width: "16px", height: "16px" }} />
            <span>📅 Schedule Changes, Rink Moves &amp; Weather Delays</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" name="sparesOn" defaultChecked={initialPrefs.notify_spare_callups} style={{ width: "16px", height: "16px" }} />
            <span>🥅 Emergency Goalie &amp; Spare Player Call-up Opportunities</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" name="announcementsOn" defaultChecked={initialPrefs.notify_announcements} style={{ width: "16px", height: "16px" }} />
            <span>📢 League Announcements &amp; Priority Broadcasts</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" name="disciplineOn" defaultChecked={initialPrefs.notify_discipline} style={{ width: "16px", height: "16px" }} />
            <span>⚖️ Disciplinary Infractions &amp; Suspension Rulings</span>
          </label>
        </div>
      </section>

      {/* Quiet Hours */}
      <section className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <h2>🌙 Quiet Hours (Do Not Disturb)</h2>
          <span className="badge">Sleep Protection</span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "13px", margin: "0 0 1rem 0" }}>
          During quiet hours, routine notifications are silenced so you are not disturbed at night.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "1rem" }}>
          <input type="checkbox" name="quietOn" defaultChecked={initialPrefs.quiet_hours_enabled} style={{ width: "16px", height: "16px" }} />
          <span>Enable Quiet Hours</span>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Quiet Hours Start
            <input
              type="time"
              name="quietStart"
              defaultValue={initialPrefs.quiet_hours_start ? initialPrefs.quiet_hours_start.slice(0, 5) : "22:00"}
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "var(--muted)" }}>
            Quiet Hours End
            <input
              type="time"
              name="quietEnd"
              defaultValue={initialPrefs.quiet_hours_end ? initialPrefs.quiet_hours_end.slice(0, 5) : "08:00"}
              style={{ height: "40px", background: "#091219", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "8px", padding: "0 10px" }}
            />
          </label>

          <input type="hidden" name="timezone" value={initialPrefs.time_zone || "America/Toronto"} />
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save Notification Preferences"}
        </button>
      </div>
    </form>
  );
}
