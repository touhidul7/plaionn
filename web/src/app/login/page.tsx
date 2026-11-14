import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-screen">
      <a className="skip-link" href="#main">
        Skip to sign in
      </a>
      <main id="main" className="auth-content" tabIndex={-1}>
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark">P</span>
          <span>
            PLAIONN<small>HOCKEY NETWORK</small>
          </span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">YOUR HOCKEY NETWORK</p>
          <h1>Your next season starts here.</h1>
          <p>Sign in to access your league, team rosters, and live Game Center.</p>
        </div>
        {error && (
          <p
            role="alert"
            style={{
              padding: "10px 14px",
              background: "#3b1a1a",
              border: "1px solid #7f1d1d",
              borderRadius: "8px",
              color: "#fca5a5",
              fontSize: "0.85rem",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            This sign-in link is invalid or expired. Please sign in with your email and password.
          </p>
        )}
        <AuthForm />
        <p className="auth-footer">
          PLAIONN Hockey Network · Multi-tenant League Architecture
        </p>
      </main>
    </div>
  );
}
