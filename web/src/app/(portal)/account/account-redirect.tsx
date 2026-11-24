"use client";

import { useEffect } from "react";

export function AccountAuthClientRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";

    // 1. If link has valid recovery or session tokens in hash
    if (
      hash.includes("access_token") ||
      hash.includes("type=recovery") ||
      search.includes("code=")
    ) {
      window.location.replace("/reset-password" + hash);
      return;
    }

    // 2. If token expired or was already clicked (Supabase OTP expired)
    if (hash.includes("otp_expired") || hash.includes("access_denied") || hash.includes("error")) {
      window.location.replace("/login?mode=reset&expired=1");
      return;
    }

    // 3. Normal unauthenticated visit
    window.location.replace("/login");
  }, []);

  return (
    <div style={{ padding: "80px 20px", textAlign: "center", color: "var(--muted)" }}>
      <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
        Verifying security session…
      </p>
      <p style={{ fontSize: "13px" }}>Connecting to PLAIONN Hockey Network</p>
    </div>
  );
}
