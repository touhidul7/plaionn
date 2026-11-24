"use client";

import { useState, useEffect } from "react";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  userType:
    | "Super Admin"
    | "Regular Admin"
    | "League Admin"
    | "Team Admin / Manager"
    | "Referee"
    | "Timekeeper"
    | "Player";
  scope: string;
  status: "Active" | "Pending" | "Suspended";
  waiverStatus: string;
  color: string;
}

const DEFAULT_USERS: PlatformUser[] = [
  {
    id: "usr-shadhin",
    name: "Shadhin (Super User)",
    email: "shadhin@plaionn.com",
    userType: "Super Admin",
    scope: "Global Platform",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#ef4444",
  },
  {
    id: "usr-01",
    name: "Platform Owner",
    email: "touhiduliet@gmail.com",
    userType: "Super Admin",
    scope: "Global Platform",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#ef4444",
  },
  {
    id: "usr-02",
    name: "Operations Manager",
    email: "operations@plaionn.com",
    userType: "Regular Admin",
    scope: "Global Platform",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#f59e0b",
  },
  {
    id: "usr-03",
    name: "BHL Commissioner",
    email: "commissioner@bhl.com",
    userType: "League Admin",
    scope: "Bangladesh Hockey League",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#10b981",
  },
  {
    id: "usr-04",
    name: "WAHL Director",
    email: "league@wavehockey.ca",
    userType: "League Admin",
    scope: "Wave Adult Hockey League",
    status: "Active",
    waiverStatus: "Exempt",
    color: "#10b981",
  },
  {
    id: "usr-05",
    name: "Marcus Johansson",
    email: "captain@northlinehc.com",
    userType: "Team Admin / Manager",
    scope: "Northline HC (Premier)",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#3b82f6",
  },
  {
    id: "usr-06",
    name: "Alexander Reed",
    email: "manager@harbourwolves.com",
    userType: "Team Admin / Manager",
    scope: "Harbour Wolves (Premier)",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#3b82f6",
  },
  {
    id: "usr-07",
    name: "David Miller",
    email: "ref.miller@ontariohockey.ca",
    userType: "Referee",
    scope: "Assigned Games",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#eab308",
  },
  {
    id: "usr-08",
    name: "Sarah Chen",
    email: "timekeeper@metroarena.ca",
    userType: "Timekeeper",
    scope: "Metro Arena Rink 1",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#06b6d4",
  },
  {
    id: "usr-09",
    name: "Nathan MacKinnon",
    email: "mackinnon@proplayers.ca",
    userType: "Player",
    scope: "Northline HC",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#8b5cf6",
  },
  {
    id: "usr-10",
    name: "Cale Makar",
    email: "makar@proplayers.ca",
    userType: "Player",
    scope: "Northline HC",
    status: "Active",
    waiverStatus: "Cleared & Signed",
    color: "#8b5cf6",
  },
];

const ROLE_COLORS: Record<PlatformUser["userType"], string> = {
  "Super Admin": "#ef4444",
  "Regular Admin": "#f59e0b",
  "League Admin": "#10b981",
  "Team Admin / Manager": "#3b82f6",
  Referee: "#eab308",
  Timekeeper: "#06b6d4",
  Player: "#8b5cf6",
};

export const AVAILABLE_LEAGUES = [
  "Wave Adult Hockey League (WAHL)",
  "Bangladesh Hockey League (BHL)",
  "Canada Hockey League (CHL)",
  "Italy Hockey League (IHL)",
];

export const AVAILABLE_TEAMS = [
  "Harbour Wolves",
  "Wave Breakers",
  "Coastal Frost",
  "Metro Blades",
  "Northline HC",
  "Dhaka Gladiators",
  "Chittagong Warriors",
  "Sylhet Strikers",
  "Rajshahi Rangers",
  "Ottawa Titans",
  "Montreal Royals",
  "Milano Vipers",
  "Roma Gladiators",
];

export const AVAILABLE_RINKS = [
  "Metro Arena · Rink 1",
  "Metro Arena · Rink 2",
  "Wave Twin Rinks · Rink A",
  "National Hockey Stadium",
];

function cleanWaiverStatus(status?: string): string {
  if (!status) return "Cleared & Signed";
  return status
    .replace(/via GHL/gi, "& Signed")
    .replace(/GHL Signature/gi, "Signature")
    .replace(/GHL/gi, "")
    .trim() || "Cleared & Signed";
}

export function AdminUsersManager() {
  const [users, setUsers] = useState<PlatformUser[]>(DEFAULT_USERS);
  const [leaguesList, setLeaguesList] = useState<string[]>(AVAILABLE_LEAGUES);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("All");
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("12345678");
  const [formRole, setFormRole] = useState<PlatformUser["userType"]>("Player");
  const [formScope, setFormScope] = useState("");
  const [formWaiver, setFormWaiver] = useState("Cleared & Signed");
  const [formStatus, setFormStatus] = useState<PlatformUser["status"]>("Active");

  // Load from API + localStorage on client mount
  useEffect(() => {
    try {
      const storedLeagues = localStorage.getItem("plaionn_custom_leagues");
      if (storedLeagues) {
        const parsedLeagues = JSON.parse(storedLeagues);
        if (Array.isArray(parsedLeagues)) {
          const names = parsedLeagues.map((l: any) => l.name).filter(Boolean);
          if (names.length > 0) {
            setLeaguesList([...new Set([...names, ...AVAILABLE_LEAGUES])]);
          }
        }
      }
    } catch {}

    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users) && data.users.length > 0) {
          const cleaned = data.users.map((u: PlatformUser) => ({
            ...u,
            waiverStatus: cleanWaiverStatus(u.waiverStatus),
          }));
          setUsers(cleaned);
          try {
            localStorage.setItem("plaionn-admin-users", JSON.stringify(cleaned));
          } catch {}
          return;
        }
        const stored = localStorage.getItem("plaionn-admin-users");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed.map((u: PlatformUser) => ({
              ...u,
              waiverStatus: cleanWaiverStatus(u.waiverStatus),
            }));
            setUsers(cleaned);
            try {
              localStorage.setItem("plaionn-admin-users", JSON.stringify(cleaned));
            } catch {}
          }
        }
      })
      .catch(() => {
        try {
          const stored = localStorage.getItem("plaionn-admin-users");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const cleaned = parsed.map((u: PlatformUser) => ({
                ...u,
                waiverStatus: cleanWaiverStatus(u.waiverStatus),
              }));
              setUsers(cleaned);
            }
          }
        } catch {
          // Ignored
        }
      });
  }, []);

  const saveUsers = (updated: PlatformUser[]) => {
    setUsers(updated);
    try {
      localStorage.setItem("plaionn-admin-users", JSON.stringify(updated));
    } catch {
      // Ignored
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleRoleChange = (newRole: PlatformUser["userType"]) => {
    setFormRole(newRole);
    if (newRole === "Super Admin" || newRole === "Regular Admin") {
      setFormScope("Global Platform");
    } else if (newRole === "League Admin") {
      setFormScope(AVAILABLE_LEAGUES[0]);
    } else if (newRole === "Team Admin / Manager" || newRole === "Player") {
      setFormScope(AVAILABLE_TEAMS[0]);
    } else if (newRole === "Timekeeper") {
      setFormScope(AVAILABLE_RINKS[0]);
    } else if (newRole === "Referee") {
      setFormScope("Assigned Games");
    }
  };

  const openAddModal = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("Player");
    setFormScope(AVAILABLE_TEAMS[0]);
    setFormWaiver("Cleared & Signed");
    setFormStatus("Active");
    setIsAddOpen(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    const payload = {
      name: formName.trim(),
      email: formEmail.trim(),
      userType: formRole,
      scope: formScope.trim() || "Global Platform",
      status: formStatus,
      waiverStatus: formWaiver,
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const updated = [data.user, ...users.filter((u) => u.email !== data.user.email)];
        saveUsers(updated);
        setIsAddOpen(false);
        showToast(`Invitation email sent to ${payload.email} via Supabase SMTP!`);
        return;
      }
    } catch {
      // Fallback
    }

    const newUser: PlatformUser = {
      id: `usr-${Date.now().toString().slice(-6)}`,
      name: formName.trim(),
      email: formEmail.trim(),
      userType: formRole,
      scope: formScope.trim() || "Global Platform",
      status: formStatus,
      waiverStatus: formWaiver,
      color: ROLE_COLORS[formRole],
    };

    const updated = [newUser, ...users];
    saveUsers(updated);
    setIsAddOpen(false);
    showToast(`User ${newUser.name} added successfully!`);
  };

  const openEditModal = (u: PlatformUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.userType);
    setFormScope(u.scope);
    setFormWaiver(u.waiverStatus);
    setFormStatus(u.status);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const payload = {
      id: editingUser.id,
      name: formName.trim(),
      email: formEmail.trim(),
      userType: formRole,
      scope: formScope.trim() || editingUser.scope,
      waiverStatus: formWaiver,
      status: formStatus,
    };

    try {
      await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Ignored
    }

    const updated = users.map((u) => {
      if (u.id === editingUser.id) {
        return {
          ...u,
          name: formName.trim(),
          email: formEmail.trim(),
          userType: formRole,
          scope: formScope.trim() || u.scope,
          waiverStatus: formWaiver,
          status: formStatus,
          color: ROLE_COLORS[formRole],
        };
      }
      return u;
    });

    saveUsers(updated);
    setEditingUser(null);
    showToast(`Updated ${formName}'s user type to ${formRole}!`);
  };

  const handleDeleteUser = async (u: PlatformUser) => {
    if (confirm(`Are you sure you want to delete user "${u.name}" (${u.email})?`)) {
      try {
        await fetch(`/api/admin/users?id=${encodeURIComponent(u.id)}`, {
          method: "DELETE",
        });
      } catch {
        // Ignored
      }
      const updated = users.filter((x) => x.id !== u.id);
      saveUsers(updated);
      showToast(`User ${u.name} deleted.`);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.scope.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "All" || u.userType === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <section id="users" className="panel" style={{ padding: "24px" }}>
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

      {/* Heading & Add User Action */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", color: "var(--text)" }}>
              Platform Users &amp; Permissions
            </h2>
            <span
              className="badge"
              style={{ background: "rgba(199, 244, 80, 0.15)", color: "var(--lime)", fontSize: "11px", fontWeight: 800 }}
            >
              Super User Controls Active
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Full control for Super User Shadhin: Add users, change user types, reassign scopes, or delete accounts.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="button primary"
          style={{ fontSize: "13px", padding: "8px 18px", fontWeight: 700 }}
        >
          + Add New User
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            "All",
            "Super Admin",
            "Regular Admin",
            "League Admin",
            "Team Admin / Manager",
            "Referee",
            "Timekeeper",
            "Player",
          ].map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className="button button-sm"
              style={{
                fontSize: "11.5px",
                padding: "4px 10px",
                background: filterRole === role ? "var(--lime)" : "#13232e",
                color: filterRole === role ? "#000" : "var(--text)",
                border: "1px solid var(--line)",
                fontWeight: filterRole === role ? 800 : 500,
              }}
            >
              {role}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name, email, or scope..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            background: "#13232e",
            border: "1px solid var(--line)",
            borderRadius: "6px",
            padding: "6px 14px",
            color: "var(--text)",
            fontSize: "13px",
            minWidth: "260px",
          }}
        />
      </div>

      {/* Users Interactive Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%", margin: 0 }}>
          <thead>
            <tr>
              <th>User &amp; Email</th>
              <th>User Type / Role</th>
              <th>Assigned Scope</th>
              <th>Waiver Status</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((usr) => (
              <tr key={usr.id}>
                <td>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ color: "var(--text)" }}>{usr.name}</strong>
                      {usr.name.includes("Shadhin") && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(239, 68, 68, 0.2)",
                            color: "#ef4444",
                            fontSize: "9px",
                            padding: "1px 6px",
                          }}
                        >
                          YOU
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>{usr.email}</span>
                  </div>
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${usr.color}22`,
                      color: usr.color,
                      border: `1px solid ${usr.color}44`,
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {usr.userType}
                  </span>
                </td>
                <td style={{ fontSize: "13px", color: "var(--text)" }}>{usr.scope}</td>
                <td style={{ fontSize: "12.5px" }}>
                  {(() => {
                    const statusText = cleanWaiverStatus(usr.waiverStatus);
                    const isCleared = statusText.includes("Cleared") || statusText.includes("Signed");
                    const isExempt = statusText.includes("Exempt");
                    return (
                      <span
                        style={{
                          color: isCleared
                            ? "var(--lime)"
                            : isExempt
                            ? "#67e8f9"
                            : "#f59e0b",
                        }}
                      >
                        {isCleared ? "✓ " : ""}
                        {statusText}
                      </span>
                    );
                  })()}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      fontSize: "10px",
                      background: usr.status === "Active" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: usr.status === "Active" ? "#10b981" : "#ef4444",
                    }}
                  >
                    {usr.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "8px" }}>
                    <button
                      onClick={() => openEditModal(usr)}
                      className="button button-sm button-outline"
                      style={{ fontSize: "11px", padding: "3px 10px" }}
                      title="Change user type and permissions"
                    >
                      Edit Role
                    </button>
                    <button
                      onClick={() => handleDeleteUser(usr)}
                      className="button button-sm"
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                      }}
                      title="Delete user"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD USER MODAL */}
      {isAddOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0d1b24",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              width: "100%",
              maxWidth: "520px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text)" }}>Add New Platform User</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Connor Bedard"
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. cbedard@chicago.com"
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div
                style={{
                  background: "rgba(103, 232, 249, 0.08)",
                  border: "1px solid rgba(103, 232, 249, 0.25)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  fontSize: "12.5px",
                  color: "var(--text)",
                  lineHeight: "1.5",
                }}
              >
                ✉️ <strong style={{ color: "var(--accent)" }}>Supabase SMTP Invite:</strong> No password needed. An invitation email with a secure link to set their own password will be sent automatically to this address.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    User Type / Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Regular Admin">Regular Admin</option>
                    <option value="League Admin">League Admin</option>
                    <option value="Team Admin / Manager">Team Admin / Manager</option>
                    <option value="Referee">Referee</option>
                    <option value="Timekeeper">Timekeeper</option>
                    <option value="Player">Player</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Assigned Scope {formRole === "League Admin" ? "(Select League)" : formRole === "Team Admin / Manager" || formRole === "Player" ? "(Select Team)" : ""}
                  </label>
                  {formRole === "Super Admin" || formRole === "Regular Admin" ? (
                    <input
                      type="text"
                      value="Global Platform (All Leagues)"
                      disabled
                      style={{
                        width: "100%",
                        background: "#0d1a24",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--muted)",
                        fontSize: "13px",
                        cursor: "not-allowed",
                      }}
                    />
                  ) : formRole === "League Admin" ? (
                    <select
                      value={formScope}
                      onChange={(e) => setFormScope(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#13232e",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      {leaguesList.map((lg) => (
                        <option key={lg} value={lg}>
                          {lg}
                        </option>
                      ))}
                    </select>
                  ) : formRole === "Team Admin / Manager" || formRole === "Player" ? (
                    <select
                      value={AVAILABLE_TEAMS.includes(formScope) ? formScope : AVAILABLE_TEAMS[0]}
                      onChange={(e) => setFormScope(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#13232e",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      {AVAILABLE_TEAMS.map((tm) => (
                        <option key={tm} value={tm}>
                          {tm}
                        </option>
                      ))}
                    </select>
                  ) : formRole === "Timekeeper" ? (
                    <select
                      value={AVAILABLE_RINKS.includes(formScope) ? formScope : AVAILABLE_RINKS[0]}
                      onChange={(e) => setFormScope(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#13232e",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      {AVAILABLE_RINKS.map((rk) => (
                        <option key={rk} value={rk}>
                          {rk}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formScope}
                      onChange={(e) => setFormScope(e.target.value)}
                      placeholder="e.g. Assigned Games or Global"
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
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Waiver Status
                  </label>
                  <select
                    value={formWaiver}
                    onChange={(e) => setFormWaiver(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Cleared & Signed">Cleared & Signed</option>
                    <option value="Pending Signature">Pending Signature</option>
                    <option value="Exempt">Exempt</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="button"
                  style={{ fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary" style={{ fontSize: "13px", fontWeight: 700 }}>
                  Send Invitation Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0d1b24",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "28px",
              width: "100%",
              maxWidth: "520px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text)" }}>
                Edit Role &amp; Permissions: {editingUser.name}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#13232e",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "var(--text)",
                    fontSize: "13.5px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    User Type / Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Regular Admin">Regular Admin</option>
                    <option value="League Admin">League Admin</option>
                    <option value="Team Admin / Manager">Team Admin / Manager</option>
                    <option value="Referee">Referee</option>
                    <option value="Timekeeper">Timekeeper</option>
                    <option value="Player">Player</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Assigned Scope {formRole === "League Admin" ? "(Select League)" : formRole === "Team Admin / Manager" || formRole === "Player" ? "(Select Team)" : ""}
                  </label>
                  {formRole === "Super Admin" || formRole === "Regular Admin" ? (
                    <input
                      type="text"
                      value="Global Platform (All Leagues)"
                      disabled
                      style={{
                        width: "100%",
                        background: "#0d1a24",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--muted)",
                        fontSize: "13px",
                        cursor: "not-allowed",
                      }}
                    />
                  ) : formRole === "League Admin" ? (
                    <select
                      value={formScope}
                      onChange={(e) => setFormScope(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#13232e",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      {leaguesList.map((lg) => (
                        <option key={lg} value={lg}>
                          {lg}
                        </option>
                      ))}
                    </select>
                  ) : formRole === "Team Admin / Manager" || formRole === "Player" ? (
                    <select
                      value={AVAILABLE_TEAMS.includes(formScope) ? formScope : AVAILABLE_TEAMS[0]}
                      onChange={(e) => setFormScope(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#13232e",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      {AVAILABLE_TEAMS.map((tm) => (
                        <option key={tm} value={tm}>
                          {tm}
                        </option>
                      ))}
                    </select>
                  ) : formRole === "Timekeeper" ? (
                    <select
                      value={AVAILABLE_RINKS.includes(formScope) ? formScope : AVAILABLE_RINKS[0]}
                      onChange={(e) => setFormScope(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#13232e",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "var(--text)",
                        fontSize: "13px",
                      }}
                    >
                      {AVAILABLE_RINKS.map((rk) => (
                        <option key={rk} value={rk}>
                          {rk}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formScope}
                      onChange={(e) => setFormScope(e.target.value)}
                      placeholder="e.g. Assigned Games or Global"
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
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Waiver Status
                  </label>
                  <select
                    value={formWaiver}
                    onChange={(e) => setFormWaiver(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Cleared & Signed">Cleared & Signed</option>
                    <option value="Pending Signature">Pending Signature</option>
                    <option value="Exempt">Exempt</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      background: "#13232e",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="button"
                  style={{ fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary" style={{ fontSize: "13px", fontWeight: 700 }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
