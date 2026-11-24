"use client";

import { useActionState, useState, useEffect } from "react";
import { authenticate } from "@/app/login/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [state, action, pending] = useActionState(authenticate, {
    error: false,
    message: "",
  });

  // Reset password states
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Automatically detect Supabase recovery email link
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
        setMode("reset");
      }
    }

    const supabase = createSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword.length < 8) {
      setResetMessage({ text: "Password must be at least 8 characters long.", error: true });
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetMessage({ text: "Passwords do not match.", error: true });
      return;
    }

    setResetLoading(true);
    setResetMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: resetPassword });

      if (error) {
        setResetLoading(false);
        setResetMessage({ text: error.message || "Failed to set password.", error: true });
      } else {
        setResetMessage({
          text: "✓ Password set successfully! Redirecting to dashboard...",
          error: false,
        });
        setTimeout(() => {
          window.location.href = "/admin";
        }, 1200);
      }
    } catch (err: any) {
      setResetLoading(false);
      setResetMessage({ text: err.message || "An error occurred.", error: true });
    }
  };

  if (mode === "reset") {
    return (
      <form onSubmit={handleSetNewPassword} className="panel form-stack auth-panel">
        <div className="auth-mode-switch" style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => setMode("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => setMode("signup")}
          >
            Create Account
          </button>
          <button
            type="button"
            className="auth-switch-btn active"
            onClick={() => setMode("reset")}
          >
            Set Password
          </button>
        </div>

        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.35rem" }}>Create New Password</h2>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
            Enter your new password below to complete setup and activate your account.
          </p>
        </div>

        {resetMessage && (
          <p
            className={`form-message ${resetMessage.error ? "error" : ""}`}
            role="status"
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              background: resetMessage.error ? "rgba(239, 68, 68, 0.1)" : "rgba(199, 244, 80, 0.1)",
              border: resetMessage.error ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(199, 244, 80, 0.3)",
              color: resetMessage.error ? "#ef4444" : "var(--lime)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            {resetMessage.text}
          </p>
        )}

        <label style={{ display: "grid", gap: "6px" }}>
          <span>New Password (min. 8 characters)</span>
          <input
            type="password"
            required
            minLength={8}
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
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
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
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
            disabled={resetLoading}
          >
            {resetLoading ? "Setting Password…" : "Save Password & Sign In →"}
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginTop: "0.5rem", textAlign: "center" }}>
          <button
            type="button"
            className="button button-outline"
            style={{ width: "100%" }}
            onClick={() => setMode("login")}
          >
            ← Return to Sign In
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="panel form-stack auth-panel">
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
              className={`auth-switch-btn ${mode === "login" ? "active" : ""}`}
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
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => setMode("reset")}
              disabled={pending}
            >
              Set Password
            </button>
          </>
        )}
      </div>

      <div>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "1.35rem" }}>
          {mode === "login"
            ? "Welcome back"
            : mode === "signup"
            ? "Join the Hockey Network"
            : "Reset your password"}
        </h2>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
          {mode === "login"
            ? "Enter your credentials to access your league and roster."
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

      {mode !== "forgot" && (
        <label style={{ display: "grid", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Password</span>
            {mode === "login" && (
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
            )}
          </div>
          <input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
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
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "Don't have an account yet? Register here"
              : "Already have an account? Sign in"}
          </button>
        )}
      </div>

      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0 0 0", textAlign: "center" }}>
        🔒 League permissions and official assignments are secured through administrator approvals.
      </p>
    </form>
  );
}
