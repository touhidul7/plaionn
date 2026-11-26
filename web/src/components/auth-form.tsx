"use client";

import { useActionState, useState, useEffect } from "react";
import { authenticate } from "@/app/login/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "otp">("login");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(authenticate, {
    error: false,
    message: "",
  });

  // Automatically forward Supabase recovery/invite links to dedicated reset-password page
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("type=recovery") ||
        hash.includes("access_token") ||
        search.includes("type=recovery") ||
        search.includes("code=") ||
        search.includes("mode=reset")
      ) {
        window.location.replace("/reset-password" + search + hash);
        return;
      }
      if (search.includes("expired=1") || hash.includes("otp_expired") || hash.includes("access_denied")) {
        setMode("forgot");
      }
    }

    const supabase = createSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        window.location.replace("/reset-password");
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setOauthLoading(true);
      setOauthError(null);
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) {
        setOauthError(error.message || "Google sign in failed. Please check credentials or use email.");
        setOauthLoading(false);
      }
    } catch {
      setOauthError("Google sign in is currently unavailable. Please sign in with email.");
      setOauthLoading(false);
    }
  };

  return (
    <form action={action} className="panel form-stack auth-panel">
      {/* Google OAuth Quick Sign In */}
      {mode !== "forgot" && (
        <div style={{ marginBottom: "0.85rem" }}>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading || pending}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "10px 16px",
              background: "#181e28",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "8px",
              color: "#f1f5f9",
              fontSize: "0.92rem",
              fontWeight: 600,
              cursor: (oauthLoading || pending) ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            {oauthLoading ? "Connecting to Google…" : "Continue with Google"}
          </button>

          {oauthError && (
            <p style={{ margin: "6px 0 0 0", fontSize: "0.8rem", color: "#f87171", textAlign: "center" }}>
              {oauthError}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              margin: "1rem 0 0.5rem 0",
              color: "var(--muted)",
              fontSize: "0.78rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.1)" }} />
            <span style={{ padding: "0 10px" }}>or continue with email</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.1)" }} />
          </div>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="auth-mode-switch" style={{ marginBottom: "1rem" }}>
        {mode === "forgot" ? (
          <div style={{ textAlign: "center", width: "100%", padding: "4px 0" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent, #67e8f9)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              🔑 Account Recovery
            </span>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`auth-switch-btn ${(mode === "login" || mode === "otp") ? "active" : ""}`}
              onClick={() => setMode("login")}
              disabled={pending}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-switch-btn ${mode === "signup" ? "active" : ""}`}
              onClick={() => setMode("signup")}
              disabled={pending}
            >
              Create Account
            </button>
          </>
        )}
      </div>

      {/* Sub-toggle for Sign In: Password vs Code / Magic Link */}
      {(mode === "login" || mode === "otp") && (
        <div style={{ display: "flex", gap: "8px", background: "rgba(0, 0, 0, 0.25)", padding: "4px", borderRadius: "8px", marginBottom: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: "0.8rem",
              fontWeight: mode === "login" ? 700 : 500,
              background: mode === "login" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              color: mode === "login" ? "#fff" : "var(--muted)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("otp")}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: "0.8rem",
              fontWeight: mode === "otp" ? 700 : 500,
              background: mode === "otp" ? "rgba(255, 255, 255, 0.12)" : "transparent",
              color: mode === "otp" ? "#fff" : "var(--muted)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Email Code / Link
          </button>
        </div>
      )}

      <div>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "1.35rem" }}>
          {mode === "login"
            ? "Welcome back"
            : mode === "otp"
            ? "Sign in with Email Code"
            : mode === "signup"
            ? "Join the Hockey Network"
            : "Reset your password"}
        </h2>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
          {mode === "login"
            ? "Enter your credentials to access your league and roster."
            : mode === "otp"
            ? "We'll send a one-time sign-in link to your email."
            : mode === "signup"
            ? "Register your account for instant portal and season access."
            : "Enter your registered email and we'll send you a link to reset your password."}
        </p>
      </div>

      <input type="hidden" name="mode" value={mode} />

      {mode === "signup" && (
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Full Name</span>
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            required
            maxLength={100}
            placeholder="e.g. Connor McDavid"
          />
        </label>
      )}

      <label style={{ display: "grid", gap: "6px" }}>
        <span>Email Address</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="player@example.com"
        />
      </label>

      {mode === "login" && (
        <label style={{ display: "grid", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Password</span>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #67e8f9)",
                fontSize: "12px",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            minLength={8}
            maxLength={128}
            required
            placeholder="••••••••"
          />
        </label>
      )}

      {mode === "signup" && (
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            placeholder="••••••••"
          />
        </label>
      )}

      <div style={{ marginTop: "0.5rem" }}>
        <button
          type="submit"
          className="button primary"
          style={{ width: "100%", padding: "12px 20px", fontSize: "1rem" }}
          disabled={pending}
        >
          {pending
            ? "Please wait…"
            : mode === "login"
            ? "Sign In to PLAIONN →"
            : mode === "otp"
            ? "Send Sign-in Code to Email →"
            : mode === "signup"
            ? "Create Free Account →"
            : "Send Password Reset Link →"}
        </button>
      </div>

      {state.message && (
        <p
          className={`form-message ${state.error ? "error" : ""}`}
          role="status"
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            background: state.error ? "rgba(239, 68, 68, 0.1)" : "rgba(199, 244, 80, 0.1)",
            border: state.error ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(199, 244, 80, 0.3)",
          }}
        >
          {state.message}
        </p>
      )}

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginTop: "0.5rem", textAlign: "center" }}>
        {mode === "forgot" ? (
          <button
            type="button"
            className="button button-outline"
            style={{ width: "100%" }}
            disabled={pending}
            onClick={() => setMode("login")}
          >
            ← Back to Sign In
          </button>
        ) : (
          <button
            type="button"
            className="button button-outline"
            style={{ width: "100%" }}
            disabled={pending}
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Don't have an account yet? Register here"}
          </button>
        )}
      </div>

      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0 0 0", textAlign: "center" }}>
        🔒 League permissions and official assignments are secured through administrator approvals.
      </p>
    </form>
  );
}
