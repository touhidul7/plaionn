"use client";

import { useActionState, useState } from "react";
import { authenticate } from "@/app/login/actions";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, action, pending] = useActionState(authenticate, {
    error: false,
    message: "",
  });

  return (
    <form action={action} className="panel form-stack auth-panel">
      {/* Mode Switcher Tabs */}
      <div className="auth-mode-switch" style={{ marginBottom: "1rem" }}>
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
      </div>

      <div>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "1.35rem" }}>
          {mode === "login" ? "Welcome back" : "Join the Hockey Network"}
        </h2>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
          {mode === "login"
            ? "Enter your credentials to access your league and roster."
            : "Register your account for instant portal and season access."}
        </p>
      </div>

      <input type="hidden" name="mode" value={mode} />

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

      <label style={{ display: "grid", gap: "6px" }}>
        <span>Password</span>
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
            : "Create Free Account →"}
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
      </div>

      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.5rem 0 0 0", textAlign: "center" }}>
        🔒 League permissions and official assignments are secured through administrator approvals.
      </p>
    </form>
  );
}
