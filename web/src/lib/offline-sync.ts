export interface QueuedGameEvent {
  client_event_id: string;
  game_id: string;
  event_kind: "goal" | "penalty";
  team_entry_id: string;
  period: string;
  clock_remaining: string;
  player_id: string;
  assist_one_id: string;
  assist_two_id: string;
  penalty_minutes: string;
  queued_at: string;
  status: "pending" | "syncing" | "failed";
  error_message?: string;
}

const STORAGE_KEY_PREFIX = "plaionn_events_queue_";

export function getOfflineQueue(gameId: string): QueuedGameEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + gameId);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveOfflineQueue(gameId: string, queue: QueuedGameEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + gameId, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to persist offline queue to localStorage", err);
  }
}

export function enqueueEvent(event: QueuedGameEvent): QueuedGameEvent[] {
  const current = getOfflineQueue(event.game_id);
  // Prevent duplicate insertion
  if (current.some((e) => e.client_event_id === event.client_event_id)) {
    return current;
  }
  const updated = [...current, event];
  saveOfflineQueue(event.game_id, updated);
  return updated;
}

export function dequeueEvent(gameId: string, clientEventId: string): QueuedGameEvent[] {
  const current = getOfflineQueue(gameId);
  const updated = current.filter((e) => e.client_event_id !== clientEventId);
  saveOfflineQueue(gameId, updated);
  return updated;
}

export function updateEventStatus(
  gameId: string,
  clientEventId: string,
  status: "pending" | "syncing" | "failed",
  errorMessage?: string
): QueuedGameEvent[] {
  const current = getOfflineQueue(gameId);
  const updated = current.map((e) => {
    if (e.client_event_id === clientEventId) {
      return { ...e, status, error_message: errorMessage };
    }
    return e;
  });
  saveOfflineQueue(gameId, updated);
  return updated;
}

