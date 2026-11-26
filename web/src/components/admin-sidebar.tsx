"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface AdminSidebarProps {
  isSuperAdmin: boolean;
  isLeagueAdminOnly: boolean;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export function AdminSidebar({
  isSuperAdmin,
  isLeagueAdminOnly,
  activeTab = "leagues",
  onSelectTab,
}: AdminSidebarProps) {
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(event.target as Node)) {
        setGearOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside
      style={{
        background: "#0c1822",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "16px 12px",
        position: "sticky",
        top: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "420px",
      }}
    >
      {/* Top Nav Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ padding: "0 8px 10px 8px", borderBottom: "1px solid var(--line)", marginBottom: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--lime)", letterSpacing: "1px", textTransform: "uppercase" }}>
            ADMIN
          </span>
        </div>

        <a
          href="#leagues"
          onClick={() => onSelectTab?.("leagues")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: 700,
            color: "var(--text)",
            background: activeTab === "leagues" ? "rgba(199, 244, 80, 0.12)" : "transparent",
            border: activeTab === "leagues" ? "1px solid rgba(199, 244, 80, 0.25)" : "1px solid transparent",
            textDecoration: "none",
          }}
        >
          <span>🏆</span>
          <span>{isLeagueAdminOnly ? "My League" : "Leagues"}</span>
        </a>
      </div>

      {/* Bottom Gear Icon & Popover Menu */}
      <div ref={gearRef} style={{ position: "relative", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
        <button
          type="button"
          onClick={() => setGearOpen((prev) => !prev)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "8px 10px",
            borderRadius: "8px",
            background: gearOpen ? "rgba(255, 255, 255, 0.08)" : "transparent",
            border: "1px solid transparent",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "left",
          }}
          title="Settings & Users"
        >
          <span style={{ fontSize: "16px" }}>⚙️</span>
          <span>Settings</span>
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--muted)" }}>
            {gearOpen ? "▲" : "▼"}
          </span>
        </button>

        {gearOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              marginBottom: "8px",
              width: "200px",
              background: "#0d1b26",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6)",
              padding: "6px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              zIndex: 100,
            }}
          >
            {isSuperAdmin && (
              <a
                href="#users"
                onClick={() => {
                  onSelectTab?.("users");
                  setGearOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "var(--text)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(199, 244, 80, 0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>👥</span>
                <span>Platform Users</span>
              </a>
            )}

            <Link
              href="/account"
              onClick={() => setGearOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                color: "var(--text)",
                textDecoration: "none",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>⚙️</span>
              <span>Account Settings</span>
            </Link>

            <div style={{ height: "1px", background: "var(--line)", margin: "4px 0" }} />

            <form action="/auth/signout" method="post" style={{ margin: 0 }}>
              <button
                type="submit"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  color: "#f87171",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
