"use client";

import { usePathname } from "next/navigation";
import React from "react";

interface PortalShellProps {
  header: React.ReactNode;
  footer: React.ReactNode;
  sponsor: React.ReactNode;
  isPlatform: boolean;
  themeColor?: string | null;
  children: React.ReactNode;
}

export function PortalShell({
  header,
  footer,
  sponsor,
  isPlatform,
  themeColor,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/league");

  if (isAdmin) {
    return (
      <div
        className="admin-console-root"
        style={{
          minHeight: "100vh",
          background: "#060d13",
          color: "var(--text, #f0f4f8)",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="public-portal-root"
      style={themeColor ? ({ "--lime": themeColor, "--brand": themeColor } as React.CSSProperties) : undefined}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {header}
      <div className="public-portal-body">
        {children}
        {!isPlatform && (
          <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", padding: "0 24px" }}>
            {sponsor}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
