"use client";

import { useState, useSyncExternalStore, useMemo } from "react";
import Link from "next/link";

export interface LeagueItem {
  id: string;
  name: string;
  domain: string;
  subdomain?: string;
  status: string;
  season: string;
  teams: number;
  commissioner: string;
  isCustom?: boolean;
}

function subscribeToLegacyLeagues(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function AdminLeaguesManager({
  initialLeagues,
  isLeagueAdminOnly,
}: {
  initialLeagues: LeagueItem[];
  isLeagueAdminOnly: boolean;
}) {
  const [leagues, setLeagues] = useState<LeagueItem[]>(initialLeagues);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [acronym, setAcronym] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [season, setSeason] = useState("Winter 2026");
  const [commissioner, setCommissioner] = useState("");

  const [saving, setSaving] = useState(false);
  const legacySnapshot = useSyncExternalStore(
    subscribeToLegacyLeagues,
    () => isLeagueAdminOnly ? "[]" : localStorage.getItem("plaionn_custom_leagues") || "[]",
    () => "[]",
  );
  const legacyLeagues = useMemo<LeagueItem[]>(() => {
    try { const value = JSON.parse(legacySnapshot); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }, [legacySnapshot]);

  const saveLeague = async (value: Pick<LeagueItem, "name" | "domain" | "season" | "commissioner"> & { legacyId?: string }) => {
    const response = await fetch("/api/admin/leagues", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.league) throw new Error(result.message || "Could not save league.");
    return result.league as LeagueItem;
  };

  const importLegacyLeagues = async () => {
    if (isLeagueAdminOnly || saving) return;
    setSaving(true);
    try {
      for (const legacy of legacyLeagues) {
        const saved = await saveLeague({ ...legacy, legacyId: legacy.id });
        setLeagues(current => [...current.filter(l => l.id !== saved.id), saved]);
        // Remove each imported entry only after the server confirms persistence.
        const remaining = JSON.parse(localStorage.getItem("plaionn_custom_leagues") || "[]") as LeagueItem[];
        const next = remaining.filter(l => l.id !== legacy.id);
        localStorage.setItem("plaionn_custom_leagues", JSON.stringify(next));
        window.dispatchEvent(new Event("storage"));
      }
      showToast("Existing leagues and commissioner assignments saved to Supabase.");
    } catch (error) { showToast(error instanceof Error ? error.message : "Import failed. Please retry."); }
    finally { setSaving(false); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10);
    if (!subdomain || subdomain.includes(".plaionn.")) {
      setSubdomain(slug ? `${slug}.plaionn.brittosoft.online` : "");
    }
    const acr = val
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);
    if (!acronym || acronym.length <= 4) {
      setAcronym(acr);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isLeagueAdminOnly || saving) return;
    setSaving(true);
    try {
      const saved = await saveLeague({ name: name.trim(), domain: subdomain.trim(), season: season.trim(), commissioner: commissioner.trim().toLowerCase() });
      setLeagues(current => [saved, ...current.filter(l => l.id !== saved.id)]);
      setShowModal(false);
      showToast("League and commissioner assignment saved.");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not create league."); }
    finally { setSaving(false); }
  };

  const handleDeleteLeague = async (lg: LeagueItem) => {
    if (confirm(`Are you sure you want to permanently delete league "${lg.name}"? This will delete all its teams, seasons, and games.`)) {
      try {
        const res = await fetch(`/api/admin/leagues?id=${encodeURIComponent(lg.id)}`, {
          method: "DELETE",
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          showToast(result.message || "Could not delete league.");
          return;
        }
        setLeagues(current => current.filter(l => l.id !== lg.id));
        showToast(`League "${lg.name}" deleted successfully.`);
      } catch {
        showToast("Could not delete league. Please retry.");
      }
    }
  };

  return (
    <section id="leagues" className="panel" style={{ padding: "24px" }}>
      {!isLeagueAdminOnly && legacyLeagues.length > 0 && (
        <div role="status" className="notice">
          <p>{legacyLeagues.length} previously created league(s) are saved only in this browser. Save them to Supabase so their assigned admins can access them.</p>
          <button className="button primary" disabled={saving} onClick={importLegacyLeagues}>{saving ? "Saving..." : "Save existing leagues to Supabase"}</button>
        </div>
      )}
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#10b981",
            color: "#000",
            fontWeight: 800,
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
            zIndex: 9999,
          }}
        >
          ✓ {toast}
        </div>
      )}

      {/* Header and Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px" }}>League Management &amp; Custom Domains</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Each league operates as an independent branded public website with unique domain and subdomain routing.
          </p>
        </div>
        {!isLeagueAdminOnly && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="button button-sm primary"
            style={{ fontWeight: 800, cursor: "pointer" }}
          >
            + Create New League
          </button>
        )}
      </div>

      {/* Leagues Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%", margin: 0 }}>
          <thead>
            <tr>
              <th style={{ minWidth: "240px" }}>League Name</th>
              <th>Live Domain</th>
              <th>Current Season</th>
              <th>Active Teams</th>
              <th>Commissioner</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((lg) => (
              <tr key={lg.id}>
                <td style={{ fontWeight: 800 }}>
                  <Link
                    href={`/admin/league/${lg.id}`}
                    style={{
                      color: "var(--text)",
                      textDecoration: "none",
                      fontSize: "14px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    title={`Manage ${lg.name} Backend`}
                  >
                    <span style={{ color: "var(--lime)" }}>{lg.name}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>→</span>
                  </Link>
                  {lg.isCustom && (
                    <span
                      className="badge"
                      style={{
                        marginLeft: "8px",
                        fontSize: "9.5px",
                        background: "rgba(168, 85, 247, 0.2)",
                        color: "#c084fc",
                      }}
                    >
                      CUSTOM REAL
                    </span>
                  )}
                </td>
                <td>
                  <a
                    href={lg.domain ? `https://${lg.domain}` : `/api/switch-league?league=${lg.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <code style={{ background: "rgba(103, 232, 249, 0.1)", border: "1px solid rgba(103, 232, 249, 0.25)", padding: "3px 8px", borderRadius: "4px", color: "#67e8f9", fontSize: "12px" }}>
                      {lg.domain || "Not configured"}
                    </code>
                    <span style={{ color: "#67e8f9", fontSize: "11px" }}>↗</span>
                  </a>
                </td>
                <td>{lg.season}</td>
                <td style={{ fontWeight: 700 }}>{lg.teams} teams</td>
                <td style={{ fontSize: "12.5px", color: "var(--muted)" }}>{lg.commissioner}</td>
                <td>
                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontSize: "10px" }}>
                    {lg.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                    <a
                      href={`/api/switch-league?league=${lg.id}&redirect=/`}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-sm button-outline"
                      style={{ fontSize: "11px", padding: "4px 10px" }}
                      title={`Launch ${lg.name} Public Site`}
                    >
                      Public ↗
                    </a>
                    {!isLeagueAdminOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLeague(lg)}
                        className="button button-sm"
                        style={{
                          fontSize: "11px",
                          padding: "4px 8px",
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          cursor: "pointer",
                        }}
                        title={`Delete ${lg.name}`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Create New League */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#0c1822",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Create New League</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeague} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  League Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Toronto Metro Hockey League"
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Acronym / Code
                  </label>
                  <input
                    type="text"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                    placeholder="e.g. TMHL"
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Inaugural Season
                  </label>
                  <input
                    type="text"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="e.g. Winter 2026"
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Domain / Subdomain Route
                </label>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="e.g. tmhl.plaionn.brittosoft.online"
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  League Commissioner Email
                </label>
                <input
                  type="email"
                  required
                  value={commissioner}
                  onChange={(e) => setCommissioner(e.target.value)}
                  placeholder="e.g. commissioner@tmhl.com"
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div
                style={{
                  background: "rgba(103, 232, 249, 0.08)",
                  border: "1px solid rgba(103, 232, 249, 0.25)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  color: "var(--text)",
                  lineHeight: "1.4",
                }}
              >
                ✉️ <strong style={{ color: "var(--accent)" }}>Supabase Invite:</strong> The commissioner receives access to this league. New users receive an invitation email to set their password.
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="button"
                  style={{ cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  className="button primary"
                  style={{ fontWeight: 800, cursor: "pointer" }}
                >
                  Create League →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
