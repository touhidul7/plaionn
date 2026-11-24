// Preserve stored identities; missing values should not invent real-world records.
export function sanitizeLeagueName(name?: string | null): string { return name?.trim() || "League"; }
export function sanitizeSeasonName(name?: string | null): string { return name?.trim() || "Season not configured"; }
export function sanitizeVenueName(name?: string | null): string { return name?.trim() || "Venue not configured"; }
export function sanitizePlayerName(name?: string | null): string { return name?.trim() || "Player"; }
