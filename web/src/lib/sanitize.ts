export function sanitizeLeagueName(name?: string | null): string {
  if (!name || /client demo/i.test(name) || /demo league/i.test(name)) {
    return "PLAIONN Hockey League";
  }
  return name.replace(/\bclient demo\b/gi, "Hockey League").replace(/\bdemo\b/gi, "").trim() || "PLAIONN Hockey League";
}

export function sanitizeSeasonName(name?: string | null): string {
  if (!name || /client review/i.test(name) || /demo/i.test(name)) {
    return "Winter 2026";
  }
  return name.trim() || "Winter 2026";
}

export function sanitizeVenueName(name?: string | null): string {
  if (!name || /demo/i.test(name)) {
    return "Metro Arena";
  }
  return name.trim() || "Metro Arena";
}

const DEMO_PLAYER_NAMES: Record<string, string> = {
  "Northline Demo Player 1": "Nathan Cole",
  "Northline Demo Player 2": "Alex Mercier",
  "Northline Demo Player 3": "Marcus Vance",
  "Wolves Demo Player 1": "Connor Hayes",
  "Wolves Demo Player 2": "Liam Gallagher",
  "Wolves Demo Player 3": "David Lindqvist",
};

export function sanitizePlayerName(name?: string | null): string {
  if (!name) return "Player";
  const trimmed = name.trim();
  if (DEMO_PLAYER_NAMES[trimmed]) return DEMO_PLAYER_NAMES[trimmed];
  return trimmed.replace(/\bdemo\s*/gi, "").replace(/\s{2,}/g, " ").trim() || "Player";
}
