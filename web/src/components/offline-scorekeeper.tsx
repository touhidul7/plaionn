"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  getOfflineQueue,
  dequeueEvent,
  updateEventStatus,
  type QueuedGameEvent,
} from "@/lib/offline-sync";
import { submitQueuedEventAction } from "@/app/(portal)/schedule/score-actions";

export function OfflineScorekeeperStatus({ gameId }: { gameId: string }) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queue, setQueue] = useState<QueuedGameEvent[]>(() => getOfflineQueue(gameId));
  const [isPending, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string>("");

  const autoSync = useCallback(() => {
    const currentQueue = getOfflineQueue(gameId);
    if (!currentQueue.length) return;

    startTransition(async () => {
      setSyncMessage("Syncing offline events...");
      for (const item of currentQueue) {
        updateEventStatus(gameId, item.client_event_id, "syncing");
        try {
          const res = await submitQueuedEventAction(item);
          if (!res.error) {
            dequeueEvent(gameId, item.client_event_id);
          } else {
            updateEventStatus(gameId, item.client_event_id, "failed", res.message);
          }
        } catch {
          updateEventStatus(gameId, item.client_event_id, "failed", "Network unreachable");
        }
      }
      setQueue(getOfflineQueue(gameId));
      setSyncMessage("Sync complete. Refreshing game log...");
      window.location.reload();
    });
  }, [gameId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      setQueue(getOfflineQueue(gameId));
    }, 3000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [gameId, autoSync]);

  return (
    <section className="panel" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <span
            className="badge"
            style={{
              backgroundColor: isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              color: isOnline ? "#10b981" : "#f59e0b",
              border: `1px solid ${isOnline ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
              padding: "4px 8px",
            }}
          >
            {isOnline ? "🟢 Rink Online" : "🟠 Rink Mode (Offline)"}
          </span>
          <span style={{ marginLeft: "10px", fontSize: "14px", color: "var(--muted)" }}>
            {queue.length ? `${queue.length} event(s) queued locally` : "All entries synced"}
          </span>
        </div>

        {queue.length > 0 && (
          <button
            type="button"
            className="primary"
            onClick={autoSync}
            disabled={isPending || !isOnline}
            style={{ padding: "6px 14px", fontSize: "13px" }}
          >
            {isPending ? "Syncing..." : "Sync Pending Events →"}
          </button>
        )}
      </div>

      {syncMessage && (
        <p role="status" style={{ fontSize: "13px", marginTop: "8px", color: "var(--muted)" }}>
          {syncMessage}
        </p>
      )}

      {queue.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "0.5rem" }}>Local Outbox (Persisted In Browser)</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {queue.map((item) => (
              <li
                key={item.client_event_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--surface)",
                  borderRadius: "6px",
                  marginBottom: "4px",
                  fontSize: "13px",
                }}
              >
                <span>
                  <strong>{item.event_kind.toUpperCase()}</strong> · P{item.period} · {item.clock_remaining}
                </span>
                <span
                  style={{
                    color:
                      item.status === "failed"
                        ? "var(--accent-warn, #ef4444)"
                        : item.status === "syncing"
                        ? "var(--accent, #3b82f6)"
                        : "var(--muted)",
                  }}
                >
                  {item.status === "failed" ? item.error_message || "Failed" : item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
