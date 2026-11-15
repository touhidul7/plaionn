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
