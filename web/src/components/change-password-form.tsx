"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters long.", error: true });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", error: true });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      setLoading(false);
      if (error) {
        setMessage({ text: error.message || "Failed to update password.", error: true });
      } else {
        setMessage({ text: "✓ Password updated successfully! Your new password is now active.", error: false });
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setLoading(false);
      setMessage({ text: err.message || "An unexpected error occurred.", error: true });
    }
  };

  return (
    <section className="panel" style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div>
          <h2 style={{ fontSize: "18px", margin: 0 }}>Security &amp; Change Password</h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0" }}>
            Set or update your login password. Must be at least 8 characters.
          </p>
        </div>
        <span className="badge" style={{ fontSize: "11px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
          Protected via Supabase Auth
        </span>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            fontWeight: 700,
            background: message.error ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
            color: message.error ? "#ef4444" : "var(--lime)",
            border: `1px solid ${message.error ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "420px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
            New Password
          </label>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter at least 8 characters"
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
            Confirm New Password
          </label>
          <input
            required
            type="password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
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

        <button
          type="submit"
          disabled={loading}
          className="button primary"
          style={{ alignSelf: "flex-start", marginTop: "4px", fontWeight: 700, padding: "8px 18px" }}
        >
          {loading ? "Updating Password..." : "Update Password"}
        </button>
      </form>
    </section>
  );
}
