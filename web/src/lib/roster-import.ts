export interface ParsedRosterRow {
  name: string;
  jersey: number | null;
  position: string;
}

export interface ValidatedRosterRow extends ParsedRosterRow {
  isValid: true;
}

export interface InvalidRosterRow extends ParsedRosterRow {
  isValid: false;
  error: string;
}

export interface RosterBatchValidationResult {
  validRows: ValidatedRosterRow[];
  errorRows: InvalidRosterRow[];
  canSubmit: boolean;
  globalError?: string;
  remainingSlots: number;
}

export function parseRosterCsv(csvText: string): ParsedRosterRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Parse lines into tokens respecting quotes
  const tokenize = (line: string): string[] => {
    const tokens: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' || ch === "'") {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        tokens.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    tokens.push(cur.trim());
    return tokens;
  };

  const rows = lines.map(tokenize);
  if (rows.length === 0) return [];

  // Detect header row if present
  let headerIndex = -1;
  let nameCol = 0;
  let jerseyCol = 1;
  let posCol = 2;

  const firstRow = rows[0].map((t) => t.toLowerCase());
  const hasHeader = firstRow.some((t) =>
    ["name", "player", "player name", "jersey", "number", "pos", "position"].includes(t)
  );

  if (hasHeader) {
    headerIndex = 0;
    firstRow.forEach((col, idx) => {
      if (col.includes("name") || col.includes("player")) nameCol = idx;
      else if (col.includes("jersey") || col.includes("num") || col === "#") jerseyCol = idx;
      else if (col.includes("pos")) posCol = idx;
    });
  }

  const dataRows = headerIndex === 0 ? rows.slice(1) : rows;
  const result: ParsedRosterRow[] = [];

  for (const row of dataRows) {
    if (row.length === 0 || row.every((c) => !c)) continue;

    const rawName = row[nameCol] || "";
    const cleanName = rawName.replace(/^["']|["']$/g, "").trim();

    const rawJersey = row[jerseyCol]?.trim() || "";
    let jerseyNum: number | null = null;
    if (rawJersey && !isNaN(Number(rawJersey))) {
      jerseyNum = parseInt(rawJersey, 10);
    }

    const rawPos = (row[posCol] || "F").toUpperCase().trim();
    const position = ["F", "D", "G", "C", "LW", "RW"].includes(rawPos) ? rawPos : "F";

    if (cleanName) {
      result.push({
        name: cleanName,
        jersey: jerseyNum,
        position,
      });
    }
  }

  return result;
}

export function validateRosterBatch(
  parsedRows: ParsedRosterRow[],
  existingRoster: { jersey_number: number | null; status: string; display_name: string }[],
  rosterLimit: number
): RosterBatchValidationResult {
  const activeExistingJerseys = new Map<number, string>();
  for (const member of existingRoster) {
    if (member.status === "active" && member.jersey_number !== null) {
      activeExistingJerseys.set(member.jersey_number, member.display_name);
    }
  }

  const currentActiveCount = existingRoster.filter((m) => m.status === "active").length;
  const remainingSlots = Math.max(0, rosterLimit - currentActiveCount);

  const seenJerseysInBatch = new Map<number, number>(); // jersey -> count
  for (const r of parsedRows) {
    if (r.jersey !== null) {
      seenJerseysInBatch.set(r.jersey, (seenJerseysInBatch.get(r.jersey) || 0) + 1);
    }
  }

  const validRows: ValidatedRosterRow[] = [];
  const errorRows: InvalidRosterRow[] = [];

  for (const row of parsedRows) {
    // 1. Name validation
    if (row.name.length < 2 || row.name.length > 100) {
      errorRows.push({
        ...row,
        isValid: false,
        error: "Player name must be between 2 and 100 characters.",
      });
      continue;
    }

    // 2. Jersey number bounds
    if (row.jersey !== null && (row.jersey < 0 || row.jersey > 99)) {
      errorRows.push({
        ...row,
        isValid: false,
        error: `Jersey number ${row.jersey} is invalid (must be 0-99).`,
      });
      continue;
    }

    // 3. Batch duplicate jersey check
    if (row.jersey !== null && (seenJerseysInBatch.get(row.jersey) || 0) > 1) {
      errorRows.push({
        ...row,
        isValid: false,
        error: `Duplicate jersey number ${row.jersey} within CSV.`,
      });
      continue;
    }

    // 4. Collision with existing active team roster
    if (row.jersey !== null && activeExistingJerseys.has(row.jersey)) {
      const takenBy = activeExistingJerseys.get(row.jersey);
      errorRows.push({
        ...row,
        isValid: false,
        error: `Jersey #${row.jersey} is already taken by active roster player (${takenBy}).`,
      });
      continue;
    }

    // 5. Valid
    validRows.push({
      ...row,
      isValid: true,
    });
  }

  let globalError: string | undefined;
  if (validRows.length > remainingSlots) {
    globalError = `Cannot import ${validRows.length} valid players: exceeds roster limit (${currentActiveCount} active, ${remainingSlots} slots remaining of ${rosterLimit}).`;
  }

  const canSubmit = validRows.length > 0 && validRows.length <= remainingSlots;

  return {
    validRows,
    errorRows,
    canSubmit,
    globalError,
    remainingSlots,
  };
}

