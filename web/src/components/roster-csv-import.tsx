"use client";

import { useState, useActionState } from "react";
import { parseRosterCsv, validateRosterBatch, type RosterBatchValidationResult } from "@/lib/roster-import";
import { submitBulkRosterImportAction, type ImportActionResult } from "@/app/(portal)/teams/[entryId]/import-actions";

interface RosterCsvImportProps {
  entryId: string;
  existingRoster: { jersey_number: number | null; status: string; display_name: string }[];
  rosterLimit: number;
}

const SAMPLE_CSV = `Player Name, Jersey Number, Position
Connor McDavid, 97, C
Leon Draisaitl, 29, C
Zach Hyman, 18, LW
Ryan Nugent-Hopkins, 93, C
Evan Bouchard, 2, D
Mattias Ekholm, 14, D
Stuart Skinner, 74, G`;

export function RosterCsvImportModal({
  entryId,
  existingRoster,
  rosterLimit,
}: RosterCsvImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [validation, setValidation] = useState<RosterBatchValidationResult | null>(null);

  const [state, formAction, isPending] = useActionState<ImportActionResult | null, FormData>(
    submitBulkRosterImportAction,
    null
  );

  const handleTextChange = (text: string) => {
    setCsvText(text);
    if (!text.trim()) {
      setValidation(null);
      return;
    }
    const parsed = parseRosterCsv(text);
    const result = validateRosterBatch(parsed, existingRoster, rosterLimit);
    setValidation(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) handleTextChange(content);
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    handleTextChange(SAMPLE_CSV);
  };

  if (!isOpen) {
    return (
      <div style={{ margin: "1rem 0" }}>
        <button
          type="button"
          className="button"
          onClick={() => setIsOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          📄 Bulk Import Roster from CSV
        </button>
      </div>
    );
  }

  return (
    <section className="panel" style={{ border: "2px solid #0284c7", marginTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>📄 Bulk Import Roster from CSV</h2>
        <button
          type="button"
          className="button button-sm button-outline"
          onClick={() => {
            setIsOpen(false);
            setCsvText("");
            setValidation(null);
          }}
        >
          Close ✕
        </button>
      </div>

      <p style={{ color: "var(--muted, #94a3b8)", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
        Import multiple players at once. Format: <code>Player Name, Jersey Number, Position (F, D, G, C, LW, RW)</code>.
      </p>

      {state && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "6px",
            backgroundColor: state.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${state.success ? "#10b981" : "#ef4444"}`,
            color: state.success ? "#34d399" : "#f87171",
          }}
        >
          {state.message}
        </div>
      )}

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", margin: "0.5rem 0" }}>
          <label className="button button-sm primary" style={{ cursor: "pointer" }}>
            📁 Choose CSV file
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
          <button type="button" className="button button-sm button-outline" onClick={loadSample}>
            Paste Sample CSV
          </button>
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
            Available slots: <strong>{validation?.remainingSlots ?? Math.max(0, rosterLimit - existingRoster.filter(r => r.status === "active").length)}</strong> of {rosterLimit}
          </span>
        </div>

        <div>
          <label htmlFor="csvTextarea" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Or paste CSV text:
          </label>
          <textarea
            id="csvTextarea"
            rows={6}
            value={csvText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Connor McDavid, 97, C&#10;Leon Draisaitl, 29, F&#10;Stuart Skinner, 74, G"
            className="input"
            style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem", padding: "0.5rem" }}
          />
        </div>
      </div>

      {validation && (
        <div>
          {validation.globalError && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                marginBottom: "1rem",
                borderRadius: "4px",
                backgroundColor: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                color: "#f87171",
              }}
            >
              ⚠️ {validation.globalError}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span className="badge" style={{ backgroundColor: "#065f46", color: "#6ee7b7" }}>
              ✓ {validation.validRows.length} Valid Players
            </span>
            {validation.errorRows.length > 0 && (
              <span className="badge" style={{ backgroundColor: "#7f1d1d", color: "#fca5a5" }}>
                ✕ {validation.errorRows.length} Errors (will be skipped)
              </span>
            )}
          </div>

          <div className="table-wrap" style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "1.25rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Player Name</th>
                  <th scope="col">Jersey</th>
                  <th scope="col">Position</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {validation.validRows.map((r, i) => (
                  <tr key={`v-${i}`}>
                    <td>
                      <span className="badge" style={{ backgroundColor: "#065f46", color: "#6ee7b7" }}>
                        Valid
                      </span>
                    </td>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.jersey !== null ? `#${r.jersey}` : "—"}</td>
                    <td><span className="badge">{r.position}</span></td>
                    <td style={{ color: "#34d399" }}>Ready to import</td>
                  </tr>
                ))}
                {validation.errorRows.map((r, i) => (
                  <tr key={`err-${i}`} style={{ opacity: 0.85 }}>
                    <td>
                      <span className="badge" style={{ backgroundColor: "#7f1d1d", color: "#fca5a5" }}>
                        Error
                      </span>
                    </td>
                    <td>{r.name || "—"}</td>
                    <td>{r.jersey !== null ? `#${r.jersey}` : "—"}</td>
                    <td>{r.position}</td>
                    <td style={{ color: "#f87171" }}>{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validation.canSubmit && (
            <form action={formAction}>
              <input type="hidden" name="entryId" value={entryId} />
              <input
                type="hidden"
                name="playersJson"
                value={JSON.stringify(
                  validation.validRows.map((r) => ({
                    name: r.name,
                    jersey: r.jersey,
                    position: r.position,
                  }))
                )}
              />
              <button type="submit" className="button primary" disabled={isPending}>
                {isPending ? "Importing Roster..." : `Confirm & Import ${validation.validRows.length} Players`}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

