"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { establishPasswordSession, PASSWORD_LINK_ERROR } from "@/lib/supabase/password-session";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const initialization = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    // Reuse the promise when React replays the effect: links are single-use.
    initialization.current ??= establishPasswordSession(
      createSupabaseBrowserClient().auth, window.location.href,
    );
    initialization.current.then(() => {
      if (active) {
        window.history.replaceState(null, "", window.location.pathname);
        setSessionReady(true);
      }
    }).catch(() => {
      if (active) {
        window.history.replaceState(null, "", window.location.pathname);
        setMessage({ text: PASSWORD_LINK_ERROR, error: true });
      }
    }).finally(() => {
      if (active) setCheckingSession(false);
    });

    return () => { active = false; };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) return;
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setSessionReady(false);
        throw new Error(PASSWORD_LINK_ERROR);
      }
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setLoading(false);
        setMessage({ text: error.message || "Failed to set new password.", error: true });
      } else {
        setMessage({
          text: "✓ Password set successfully! Redirecting to your dashboard...",
          error: false,
        });
        setTimeout(() => {
          window.location.href = "/admin";
        }, 1200);
      }
    } catch (err: unknown) {
      setLoading(false);
      setMessage({ text: err instanceof Error ? err.message : "An error occurred.", error: true });
    }
  };

  return (
    <div className="auth-screen">
      <main id="main" className="auth-content" tabIndex={-1}>
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark">P</span>
          <span className="brand-info">
            <span className="brand-title">PLAIONN</span>
            <small>HOCKEY NETWORK</small>
          </span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">ACCOUNT SETUP &amp; SECURITY</p>
          <h1>Set Your New Password</h1>
          <p>Create a secure password to activate your account and access your leagues.</p>
        </div>

        <form onSubmit={handleReset} className="panel form-stack auth-panel">
          {checkingSession && <p role="status">Verifying your password link…</p>}
          {!checkingSession && !sessionReady && (
            <Link href="/login?mode=reset&expired=1">Request a new reset link</Link>
          )}
          {message && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "12px",
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

          <label style={{ display: "grid", gap: "6px" }}>
            <span>New Password (min. 8 characters)</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span>Confirm New Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
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
          </label>

          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="submit"
              className="button primary"
              style={{ width: "100%", padding: "12px 20px", fontSize: "1rem", fontWeight: 800 }}
              disabled={loading || !sessionReady}
            >
              {loading ? "Setting Password…" : "Save Password & Sign In →"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginTop: "0.5rem", textAlign: "center" }}>
            <Link href="/login" className="button button-outline" style={{ width: "100%", textDecoration: "none" }}>
              ← Return to Login
            </Link>
          </div>
        </form>

        <p className="auth-footer">
          PLAIONN Hockey Network · Multi-tenant League Architecture
        </p>
      </main>
    </div>
  );
}
