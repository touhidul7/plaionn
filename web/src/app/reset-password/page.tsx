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

  // Stable single Supabase client instance
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const tokensRef = useRef<{ access_token: string; refresh_token: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function initSession() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.slice(1));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");

        if (access_token && refresh_token) {
          tokensRef.current = { access_token, refresh_token };
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error && data.session && active) {
            setSessionReady(true);
            setCheckingSession(false);
            return;
          }
        }

        const code = url.searchParams.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session && active) {
            setSessionReady(true);
            setCheckingSession(false);
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (data.session && active) {
          setSessionReady(true);
        } else if (active) {
          setMessage({ text: PASSWORD_LINK_ERROR, error: true });
        }
      } catch {
        if (active) setMessage({ text: PASSWORD_LINK_ERROR, error: true });
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && active) {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase]);

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
      // Ensure session is active before updating user
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session && tokensRef.current) {
        await supabase.auth.setSession(tokensRef.current);
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
