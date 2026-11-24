"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem("plaionn_custom_leagues");
      if (stored) {
        const customLeagues: LeagueItem[] = JSON.parse(stored);
        if (Array.isArray(customLeagues) && customLeagues.length > 0) {
          const customIds = new Set(customLeagues.map((l) => l.id));
          const merged = [...initialLeagues.filter((l) => !customIds.has(l.id)), ...customLeagues];
          setLeagues(merged);
        }
      }
    } catch (e) {
      console.warn("Could not load custom leagues from localStorage:", e);
    }
  }, [initialLeagues]);

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

    const commEmail = commissioner.trim().toLowerCase();
    const commName = commEmail ? commEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Commissioner";
    const slug = acronym.toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    const newId = `league-custom-${slug}-${Date.now().toString().slice(-4)}`;
    const domainName = subdomain.trim() || `${slug}.plaionn.brittosoft.online`;

    const newLeague: LeagueItem = {
      id: newId,
      name: name.trim(),
      domain: domainName,
      subdomain: domainName,
      status: "Active",
      season: season.trim() || "Winter 2026",
      teams: 0,
      commissioner: commEmail || "admin@plaionn.com",
      isCustom: true,
    };

    // 1. Dispatch Supabase user creation & invite email to the Commissioner
    if (commEmail && commEmail.includes("@")) {
      try {
        await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${commName} (${name.trim()} Commissioner)`,
            email: commEmail,
            userType: "League Admin",
            scope: name.trim(),
            waiverStatus: "Exempt",
          }),
        });
      } catch (err) {
        console.warn("Could not dispatch commissioner invite to Supabase:", err);
      }
    }

    // Also initialize an empty league backend state in localStorage for this league
    try {
      const initialBackendData = {
        id: newId,
        name: newLeague.name,
        domain: newLeague.domain,
        subdomain: newLeague.subdomain,
        season: newLeague.season,
        commissioner: newLeague.commissioner,
        divisions: [
          { id: "d1", name: "Premier Division", description: "Top-tier division", teamCount: 0 },
        ],
        teams: [],
        schedule: [],
      };
      localStorage.setItem(`plaionn_league_data_${newId}`, JSON.stringify(initialBackendData));
    } catch (e) {
      console.warn("Failed saving initial custom league backend data", e);
    }

    const updated = [newLeague, ...leagues];
    setLeagues(updated);

    try {
      const existingCustom = JSON.parse(localStorage.getItem("plaionn_custom_leagues") || "[]");
      localStorage.setItem("plaionn_custom_leagues", JSON.stringify([newLeague, ...existingCustom]));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }

    setShowModal(false);
    setName("");
    setAcronym("");
    setSubdomain("");
    setCommissioner("");
    showToast(`League "${newLeague.name}" created & commissioner invite dispatched to ${commEmail || "email"}! Opening Hub...`);
    // Immediately navigate directly into the new league's Backend Hub for Demo Day flow
    setTimeout(() => {
      window.location.href = `/admin/league/${newId}`;
    }, 700);
  };

  const handleDeleteCustomLeague = (id: string, leagueName: string) => {
    if (confirm(`Are you sure you want to delete "${leagueName}"?`)) {
      const updated = leagues.filter((l) => l.id !== id);
      setLeagues(updated);
      try {
        const stored = JSON.parse(localStorage.getItem("plaionn_custom_leagues") || "[]");
        const filtered = stored.filter((l: any) => l.id !== id);
        localStorage.setItem("plaionn_custom_leagues", JSON.stringify(filtered));
        localStorage.removeItem(`plaionn_league_data_${id}`);
      } catch (e) {
        console.warn("Could not delete from localStorage:", e);
      }
      showToast(`League "${leagueName}" deleted.`);
    }
  };

  return (
    <section id="leagues" className="panel" style={{ padding: "24px" }}>
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
              <th>League Name</th>
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
                      color: "var(--lime)",
                      textDecoration: "underline",
                      textUnderlineOffset: "4px",
                    }}
                    title={`Manage ${lg.name} Backend`}
                  >
                    {lg.name}
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
                    href={`https://${lg.domain}`}
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
                      {lg.domain}
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
                    <Link
                      href={`/admin/league/${lg.id}`}
                      className="button button-sm primary"
                      style={{ fontSize: "11px", padding: "4px 10px", fontWeight: 800 }}
                    >
                      Backend Hub →
                    </Link>
                    <a
                      href={`https://${lg.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-sm button-outline"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      title={`Launch ${lg.name}`}
                    >
                      Public ↗
                    </a>
                    {lg.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomLeague(lg.id, lg.name)}
                        className="button button-sm"
                        style={{
                          fontSize: "11px",
                          padding: "4px 8px",
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          cursor: "pointer",
                        }}
                        title="Delete custom league"
                      >
                        🗑
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
                ✉️ <strong style={{ color: "var(--accent)" }}>Supabase Invite:</strong> Creating this league automatically creates the League Admin account in Supabase Auth and triggers an invitation email to this commissioner.
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
                  type="submit"
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
