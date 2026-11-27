"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminLeaguesManager, type LeagueItem } from "@/components/admin-leagues-manager";
import { AdminUsersManager } from "@/components/admin-users-manager";

interface CentralAdminShellProps {
  initialLeagues: LeagueItem[];
  isLeagueAdminOnly: boolean;
  showUserSettings: boolean;
  roleDefinitions: {
    role: string;
    scope: string;
    permissions: string;
    color: string;
  }[];
}

export function CentralAdminShell({
  initialLeagues,
  isLeagueAdminOnly,
  showUserSettings,
  roleDefinitions,
}: CentralAdminShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "leagues");

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const setTab = (key: string) => {
    setActiveTab(key);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/admin?tab=${key}`);
    }
  };

  const navTabs = [
    { key: "leagues", label: isLeagueAdminOnly ? "My League" : "Leagues & Domains", icon: "🏆", badge: initialLeagues.length },
    ...(showUserSettings ? [{ key: "users", label: "Platform Users & Roles", icon: "👥" }] : []),
    { key: "settings", label: "Admin Settings", icon: "⚙️" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060d13",
        color: "#f0f4f8",
        width: "100%",
      }}
    >
      {/* Top Header & Horizontal Nav Bar: Sticky to top per Client Requirements */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "#081017",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* 1. Top Header Row (Logo, Title, Tools & Settings) */}
        <header
          style={{
            background: "#081017",
            borderBottom: "1px solid #162634",
            padding: "14px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "nowrap",
          }}
        >
        {/* Left: Brand Crest & Admin Console Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "var(--lime, #c7f450)",
              color: "#081017",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "18px",
              flexShrink: 0,
            }}
          >
            ⚙
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap" }}>
                PLAIONN Multi-League Admin
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "var(--lime, #c7f450)",
                  letterSpacing: "0.5px",
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                CENTRAL HQ
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
              Multi-Tenant Operating System &amp; Governance
            </span>
          </div>
        </div>

        {/* Right Tools: Public Site link & Settings */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <Link
            href="/"
            target="_blank"
            className="button button-sm button-outline"
            style={{ fontSize: "12px", padding: "7px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
            title="Open Public Front-End Website"
          >
            Public Website ↗
          </Link>

          <Link
            href="/account"
            className="button button-sm button-outline"
            style={{ fontSize: "12px", padding: "7px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Account
          </Link>

          <button
            type="button"
            onClick={() => setTab("settings")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              background: activeTab === "settings" ? "var(--lime, #c7f450)" : "#101d27",
              color: activeTab === "settings" ? "#081017" : "#f0f4f8",
              border: "1px solid #1e3347",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
              whiteSpace: "nowrap",
            }}
            title="Admin Platform Settings"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* 2. Main Tab Navigation Bar: Horizontal Bar (No Sidebar) */}
      <nav
        style={{
          background: "#091219",
          borderBottom: "1px solid #162634",
          padding: "0 24px",
          display: "flex",
          gap: "4px",
          overflowX: "auto",
        }}
      >
        {navTabs.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                border: "none",
                borderBottom: isActive ? "3px solid var(--lime, #c7f450)" : "3px solid transparent",
                background: "transparent",
                color: isActive ? "#ffffff" : "#94a3b8",
                fontSize: "13px",
                fontWeight: isActive ? 800 : 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    background: isActive ? "var(--lime, #c7f450)" : "rgba(255,255,255,0.08)",
                    color: isActive ? "#081017" : "var(--muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      </div>

      {/* 3. Main Content Body: Standardized Full-Width Layout */}
      <main style={{ padding: "24px 28px", maxWidth: "1440px", margin: "0 auto" }}>
        {/* Tab 1: Leagues & Domains */}
        {activeTab === "leagues" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <AdminLeaguesManager initialLeagues={initialLeagues} isLeagueAdminOnly={isLeagueAdminOnly} />
          </div>
        )}

        {/* Tab 2: Platform Users & Access Roles (Super Admin) */}
        {activeTab === "users" && showUserSettings && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <AdminUsersManager />

            {/* Embedded Roles & Permissions Matrix */}
            <div className="panel" style={{ padding: "24px", background: "#0c1822", border: "1px solid #162634", borderRadius: "12px" }}>
              <div style={{ marginBottom: "18px" }}>
                <h3 style={{ margin: 0, fontSize: "16px" }}>Platform Access Control &amp; Roles Matrix</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
                  Central administration enforces strict role separation across the entire ecosystem.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                {roleDefinitions.map((item) => (
                  <div
                    key={item.role}
                    style={{
                      background: "#081017",
                      border: "1px solid #162634",
                      borderRadius: "10px",
                      padding: "16px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "14px", color: item.color }}>{item.role}</strong>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(255,255,255,0.08)",
                          color: "var(--muted)",
                        }}
                      >
                        {item.scope}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>
                      {item.permissions}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Admin Settings & System Overview */}
        {activeTab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#0c1822", border: "1px solid #162634", borderRadius: "12px", padding: "24px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "16px" }}>Platform Environment &amp; System Settings</h3>
              <p style={{ margin: "0 0 20px", fontSize: "12.5px", color: "var(--muted)" }}>
                Global SaaS configuration, multi-tenant isolation, and administrator session management.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                <div style={{ background: "#081017", border: "1px solid #162634", borderRadius: "10px", padding: "16px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Platform Mode</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--lime, #c7f450)", marginTop: "4px" }}>
                    Multi-Tenant SaaS
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Independent subdomains and custom domains supported</span>
                </div>

                <div style={{ background: "#081017", border: "1px solid #162634", borderRadius: "10px", padding: "16px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Registered Leagues</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "4px" }}>
                    {initialLeagues.length} Active
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>With isolated database scoping &amp; season settings</span>
                </div>

                <div style={{ background: "#081017", border: "1px solid #162634", borderRadius: "10px", padding: "16px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>Administrator Role</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: showUserSettings ? "#ef4444" : "#10b981", marginTop: "4px" }}>
                    {showUserSettings ? "Super Admin" : "League Commissioner"}
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Authorized for cross-league governance</span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #162634", paddingTop: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px" }}>Session &amp; Account Control</h4>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Manage your credentials or terminate current administrative session.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Link href="/account" className="button button-sm button-outline" style={{ fontSize: "12px", padding: "6px 14px", textDecoration: "none" }}>
                    Manage Account
                  </Link>
                  <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                    <button
                      type="submit"
                      className="button button-sm"
                      style={{ fontSize: "12px", padding: "6px 14px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px", cursor: "pointer", fontWeight: 700 }}
                    >
                      Sign Out
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
