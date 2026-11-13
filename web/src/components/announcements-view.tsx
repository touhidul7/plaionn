"use client";

import { useActionState } from "react";
import type { AnnouncementItem } from "@/lib/announcements-schema";
import {
  publishAnnouncementAction,
  deleteAnnouncementAction,
  type ActionResult,
} from "@/app/(portal)/announcements/actions";

interface AnnouncementsViewProps {
  announcements: AnnouncementItem[];
  teams: { entryId: string; name: string }[];
  canManage: boolean;
}

export function AnnouncementsView({
  announcements,
  teams,
  canManage,
}: AnnouncementsViewProps) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Feed */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>📢 League &amp; Locker Room Notices</h2>
          <span style={{ fontSize: "0.85rem", color: "var(--muted, #94a3b8)" }}>
            {announcements.length} active broadcast{announcements.length === 1 ? "" : "s"}
          </span>
        </div>

        {announcements.length === 0 ? (
          <p style={{ color: "var(--muted, #94a3b8)" }}>
            No active announcements posted.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {announcements.map((ann) => (
              <AnnouncementCard
                key={ann.announcement_id}
                announcement={ann}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>

      {/* Commissioner Post Panel */}
      {canManage && (
        <details className="panel" style={{ marginTop: "0.5rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            ➕ Commissioner: Post New Announcement / Urgent Broadcast
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <PublishAnnouncementForm teams={teams} />
          </div>
        </details>
      )}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  canManage,
}: {
  announcement: AnnouncementItem;
  canManage: boolean;
}) {
  const [, deleteAction, isDeleting] = useActionState<ActionResult | null, FormData>(
    deleteAnnouncementAction,
    null
  );

  const isUrgent = announcement.priority === "urgent";
  const isImportant = announcement.priority === "important";

  const borderColor = isUrgent ? "#ef4444" : isImportant ? "#f59e0b" : "rgba(255,255,255,0.12)";
  const bgOpacity = isUrgent ? "rgba(239, 68, 68, 0.08)" : isImportant ? "rgba(245, 158, 11, 0.08)" : "transparent";

  const dateStr = new Date(announcement.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <article
      className="panel"
      style={{
        border: `1px solid ${borderColor}`,
        backgroundColor: bgOpacity,
        padding: "1rem",
        borderRadius: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem", flexWrap: "wrap" }}>
            {isUrgent ? (
              <span className="badge" style={{ backgroundColor: "#991b1b", color: "#fecaca" }}>🚨 URGENT</span>
            ) : isImportant ? (
              <span className="badge" style={{ backgroundColor: "#92400e", color: "#fde68a" }}>⚠️ IMPORTANT</span>
            ) : (
              <span className="badge" style={{ backgroundColor: "#27272a", color: "#d4d4d8" }}>📢 NOTICE</span>
            )}

            {announcement.is_pinned && (
              <span className="badge" style={{ backgroundColor: "#1e3a8a", color: "#93c5fd" }}>📌 PINNED</span>
            )}

            <span style={{ fontSize: "0.75rem", color: "var(--muted, #94a3b8)" }}>
              {announcement.team_name ? `🔒 ${announcement.team_name} Locker Room` : "🌐 League-Wide"}
            </span>
          </div>

          <h3 style={{ margin: "0.25rem 0", fontSize: "1.1rem" }}>{announcement.title}</h3>
        </div>

        {canManage && (
          <form action={deleteAction}>
            <input type="hidden" name="announcementId" value={announcement.announcement_id} />
            <button
              type="submit"
              disabled={isDeleting}
              className="text-link"
              style={{ color: "#ef4444", fontSize: "0.75rem", cursor: "pointer" }}
            >
              {isDeleting ? "..." : "Remove"}
            </button>
          </form>
        )}
      </div>

      <p style={{ margin: "0.5rem 0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        {announcement.message}
      </p>

      <span style={{ fontSize: "0.75rem", color: "var(--muted, #94a3b8)" }}>
        Posted {dateStr}
      </span>
    </article>
  );
}

function PublishAnnouncementForm({ teams }: { teams: { entryId: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    publishAnnouncementAction,
    null
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: "1rem", maxWidth: "600px" }}>
      {state && (
        <div
          role="status"
          style={{
            padding: "0.75rem",
            borderRadius: "4px",
            backgroundColor: state.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: state.success ? "#34d399" : "#f87171",
          }}
        >
          {state.message}
        </div>
      )}

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Title:</label>
        <input
          name="title"
          type="text"
          required
          placeholder="e.g. Schedule Update: Rink 2 Resurfacing Delay"
          className="input"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Priority:</label>
          <select name="priority" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            <option value="standard">Standard Notice</option>
            <option value="important">Important (Highlighted)</option>
            <option value="urgent">Urgent Alert (Pulsing Red)</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Audience Scope:</label>
          <select name="teamEntryId" className="input" style={{ width: "100%", padding: "0.5rem" }}>
            <option value="">🌐 Everyone (League-Wide)</option>
            {teams.map((t) => (
              <option key={t.entryId} value={t.entryId}>
                🔒 {t.name} (Team Only)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>Message:</label>
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Detailed notice information, instructions, or locker room assignments..."
          className="input"
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </div>

      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" name="isPinned" value="true" />
          📌 Pin to top of feed
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
          Expires in:
          <select name="expiresHours" className="input" style={{ padding: "0.25rem" }}>
            <option value="">Never (Keep until deleted)</option>
            <option value="24">24 Hours</option>
            <option value="48">48 Hours</option>
            <option value="168">1 Week</option>
          </select>
        </label>
      </div>

      <div>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? "Broadcasting..." : "Publish Broadcast"}
        </button>
      </div>
    </form>
  );
}

