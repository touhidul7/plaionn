"use client";

import React, { useState, useRef } from "react";
import { bulkImportScheduleAction, type BulkImportItem } from "@/app/(portal)/schedule/import-schedule-action";
import type { Entry, Rink, Venue } from "@/lib/schedule-schema";

interface ScheduleImporterProps {
  leagueId: string;
  entries: Entry[];
  venues: Venue[];
  rinks: Rink[];
}

interface ParsedGameRow {
  id: string;
  date: string;
  time: string;
  homeRaw: string;
  awayRaw: string;
  rinkRaw?: string;
  duration: number;
  homeEntryId: string | null;
  awayEntryId: string | null;
  rinkId: string | null;
  status: "ready" | "error";
  errorMessage?: string;
}

export function ScheduleImporter({ leagueId, entries, venues, rinks }: ScheduleImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedGameRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultRink = rinks[0] || null;

  // Matching helper for team names
  const matchTeam = (raw: string): Entry | null => {
    if (!raw) return null;
    const clean = raw.trim().toLowerCase();
    // exact match
    const exact = entries.find(e => e.label.toLowerCase() === clean);
    if (exact) return exact;
    // partial contains
    const partial = entries.find(e => e.label.toLowerCase().includes(clean) || clean.includes(e.label.toLowerCase()));
    if (partial) return partial;
    return null;
  };

  // Matching helper for rink
  const matchRink = (raw?: string): Rink | null => {
    if (!raw) return defaultRink;
    const clean = raw.trim().toLowerCase();
    const found = rinks.find(r => {
      const v = venues.find(ven => ven.id === r.venue_id);
      const fullName = `${v?.name ?? ""} ${r.name}`.toLowerCase();
      return r.name.toLowerCase().includes(clean) || fullName.includes(clean);
    });
    return found || defaultRink;
  };

  const parseCsvLines = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    const rows: ParsedGameRow[] = [];
    const isHeader = lines[0].toLowerCase().includes("home") || lines[0].toLowerCase().includes("date");
    const startIndex = isHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      // Split by comma or tab
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      if (parts.length < 4) continue;

      const dateStr = parts[0]?.trim() || "";
      const timeStr = parts[1]?.trim() || "";
      const homeRaw = parts[2]?.trim() || "";
      const awayRaw = parts[3]?.trim() || "";
      const rinkRaw = parts[4]?.trim() || "";
      const durStr = parts[5]?.trim() || "60";

      const matchedHome = matchTeam(homeRaw);
      const matchedAway = matchTeam(awayRaw);
      const matchedRink = matchRink(rinkRaw);
      const duration = parseInt(durStr, 10) || 60;

      let error = "";
      if (!dateStr) error = "Missing Date";
      else if (!timeStr) error = "Missing Time";
      else if (!matchedHome) error = `Unknown Home Team "${homeRaw}"`;
      else if (!matchedAway) error = `Unknown Away Team "${awayRaw}"`;
      else if (matchedHome.id === matchedAway?.id) error = "Home and Away cannot be identical";
      else if (!matchedRink) error = "No Rink available";

      // Normalize date to YYYY-MM-DD
      let normalizedDate = dateStr;
      if (dateStr.includes("/")) {
        const dp = dateStr.split("/");
        if (dp.length === 3) {
          const y = dp[2].length === 2 ? `20${dp[2]}` : dp[2];
          const m = dp[0].padStart(2, "0");
          const d = dp[1].padStart(2, "0");
          normalizedDate = `${y}-${m}-${d}`;
        }
      }

      // Normalize time to HH:MM (24h)
      let normalizedTime = timeStr;
      if (timeStr.toLowerCase().includes("pm") || timeStr.toLowerCase().includes("am")) {
        const isPm = timeStr.toLowerCase().includes("pm");
        const cleanT = timeStr.toLowerCase().replace(/am|pm/g, "").trim();
        const tp = cleanT.split(":");
        let h = parseInt(tp[0], 10);
        const m = tp[1] ? tp[1].padStart(2, "0") : "00";
        if (isPm && h < 12) h += 12;
        if (!isPm && h === 12) h = 0;
        normalizedTime = `${String(h).padStart(2, "0")}:${m}`;
      } else if (timeStr.includes(":") && timeStr.split(":")[0].length === 1) {
        normalizedTime = `0${timeStr}`;
      }

      rows.push({
        id: crypto.randomUUID(),
        date: normalizedDate,
        time: normalizedTime,
        homeRaw,
        awayRaw,
        rinkRaw,
        duration,
        homeEntryId: matchedHome?.id ?? null,
        awayEntryId: matchedAway?.id ?? null,
        rinkId: matchedRink?.id ?? null,
        status: error ? "error" : "ready",
        errorMessage: error || undefined,
      });
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setPastedText(text);
        parseCsvLines(text);
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const homeExample = entries[0]?.label || "Team Alpha";
    const awayExample = entries[1]?.label || "Team Beta";
    const rinkExample = rinks[0]?.name || "Rink 1";
    const sample = `Date,Time,Home Team,Away Team,Venue / Rink,Duration
2026-12-05,19:00,${homeExample},${awayExample},${rinkExample},60
2026-12-05,20:15,${awayExample},${homeExample},${rinkExample},60
2026-12-12,18:30,${homeExample},${awayExample},${rinkExample},60`;

    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plaionn_schedule_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStartImport = async () => {
    const readyRows = parsedRows.filter(r => r.status === "ready" && r.homeEntryId && r.awayEntryId && r.rinkId);
    if (readyRows.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: readyRows.length, success: 0, failed: 0 });
    const logs: string[] = [];

    const importPayload: BulkImportItem[] = readyRows.map((row) => ({
      id: row.id,
      homeEntryId: row.homeEntryId!,
      awayEntryId: row.awayEntryId!,
      rinkId: row.rinkId!,
      localStart: `${row.date}T${row.time}`,
      duration: row.duration,
      status: "scheduled",
    }));

    try {
      const res = await bulkImportScheduleAction({
        leagueId,
        games: importPayload,
      });

      if (res.success) {
        logs.push(`✅ Successfully imported ${res.importedCount} game(s) into database schedule.`);
        if (res.errors.length > 0) {
          res.errors.forEach((e) => logs.push(`⚠️ ${e}`));
        }
        setImportProgress({
          current: readyRows.length,
          total: readyRows.length,
          success: res.importedCount,
          failed: res.errors.length,
        });
      } else {
        logs.push(`❌ Import failed: ${res.errors.join(", ") || "Unknown error"}`);
        setImportProgress({
          current: readyRows.length,
          total: readyRows.length,
          success: 0,
          failed: readyRows.length,
        });
      }
    } catch (err: any) {
      logs.push(`❌ Import error: ${err.message || "Failed to execute bulk import"}`);
      setImportProgress({
        current: readyRows.length,
        total: readyRows.length,
        success: 0,
        failed: readyRows.length,
      });
    }

    setImportLogs(logs);
    setIsImporting(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="button primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 700,
          background: "var(--lime)",
          color: "#081017",
          padding: "8px 16px",
          borderRadius: "8px",
        }}
      >
        <span>📥 Bulk Schedule Importer</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0c1822",
              border: "1px solid #1f394d",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "880px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px" }}>
                  COMMISSIONER UTILITY
                </span>
                <h2 style={{ margin: "4px 0 0", fontSize: "20px", color: "#f0f4f8" }}>
                  Bulk Import Match Schedule (CSV / Excel)
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                  Upload a spreadsheet or paste rows with Date, Time, Home Team, Away Team, and Rink.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setImportLogs([]);
                  setImportProgress(null);
                }}
                className="button button-sm button-outline"
                style={{ fontSize: "18px", padding: "4px 10px" }}
              >
                ✕
              </button>
            </div>

            {/* Actions: Download Template & File Input */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                padding: "16px",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed #203a4c",
                borderRadius: "12px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                  Choose a CSV / Excel file or download the formatted template
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  Columns: Date (YYYY-MM-DD), Time (HH:MM), Home Team, Away Team, Rink, Duration
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="button button-sm button-outline"
                  style={{ fontSize: "12px" }}
                >
                  📄 Download CSV Template
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="button button-sm primary"
                  style={{ fontSize: "12px" }}
                >
                  📁 Select CSV File
                </button>
              </div>
            </div>

            {/* Paste Box */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                Or paste spreadsheet rows directly (CSV / tab-delimited):
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  parseCsvLines(e.target.value);
                }}
                placeholder="2026-12-05, 19:00, Team Alpha, Team Beta, Rink 1, 60&#10;2026-12-05, 20:15, Team Gamma, Team Delta, Rink 1, 60"
                rows={4}
                style={{
                  width: "100%",
                  background: "#081017",
                  border: "1px solid #1f394d",
                  borderRadius: "8px",
                  color: "#f0f4f8",
                  padding: "10px",
                  fontFamily: "monospace",
                  fontSize: "12.5px",
                }}
              />
            </div>

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                    Parsed Games Preview ({parsedRows.length} rows, {parsedRows.filter(r => r.status === "ready").length} ready to import)
                  </span>
                  {parsedRows.some(r => r.status === "error") && (
                    <span style={{ fontSize: "11px", color: "#f87171", fontWeight: 600 }}>
                      ⚠️ {parsedRows.filter(r => r.status === "error").length} rows contain issues
                    </span>
                  )}
                </div>

                <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #1f394d", borderRadius: "8px" }}>
                  <table className="table" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "95px" }}>DATE</th>
                        <th style={{ width: "70px" }}>TIME</th>
                        <th>HOME TEAM</th>
                        <th>AWAY TEAM</th>
                        <th>RINK</th>
                        <th style={{ width: "90px", textAlign: "right" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((r, idx) => (
                        <tr key={r.id} style={{ background: r.status === "error" ? "rgba(239, 68, 68, 0.08)" : undefined }}>
                          <td>{r.date}</td>
                          <td>{r.time}</td>
                          <td>
                            <strong style={{ color: r.homeEntryId ? "var(--text)" : "#f87171" }}>
                              {r.homeRaw}
                            </strong>
                          </td>
                          <td>
                            <strong style={{ color: r.awayEntryId ? "var(--text)" : "#f87171" }}>
                              {r.awayRaw}
                            </strong>
                          </td>
                          <td style={{ color: "var(--muted)" }}>
                            {r.rinkRaw || defaultRink?.name || "Rink 1"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {r.status === "ready" ? (
                              <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontSize: "10px" }}>
                                READY
                              </span>
                            ) : (
                              <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontSize: "10px" }} title={r.errorMessage}>
                                {r.errorMessage}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Progress & Logs */}
            {importProgress && (
              <div style={{ padding: "12px", background: "#081017", borderRadius: "8px", border: "1px solid #1f394d" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span>Import Progress: {importProgress.current} / {importProgress.total}</span>
                  <span>
                    <strong style={{ color: "#10b981" }}>{importProgress.success} succeeded</strong>
                    {importProgress.failed > 0 && <strong style={{ color: "#ef4444", marginLeft: "8px" }}>{importProgress.failed} failed</strong>}
                  </span>
                </div>
                <div style={{ height: "6px", background: "#1f394d", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                      background: "var(--lime)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                {importLogs.length > 0 && (
                  <div style={{ marginTop: "10px", maxHeight: "120px", overflowY: "auto", fontSize: "11px", fontFamily: "monospace" }}>
                    {importLogs.map((log, i) => (
                      <div key={i} style={{ color: log.startsWith("✅") ? "#a7f3d0" : "#fca5a5" }}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setImportLogs([]);
                  setImportProgress(null);
                }}
                className="button button-outline"
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={isImporting || parsedRows.filter(r => r.status === "ready").length === 0}
                className="button primary"
                style={{ fontWeight: 800, background: "var(--lime)", color: "#081017" }}
              >
                {isImporting
                  ? `Importing (${importProgress?.current ?? 0}/${importProgress?.total ?? 0})...`
                  : `Import ${parsedRows.filter(r => r.status === "ready").length} Valid Games`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
