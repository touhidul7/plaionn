import {AuthForm} from "@/components/auth-form";
import Link from "next/link";
export const dynamic="force-dynamic";
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {error}=await searchParams;
 return <div className="auth-screen"><a className="skip-link" href="#main">Skip to sign in</a><main id="main" className="auth-content" tabIndex={-1}><Link href="/login" className="brand auth-brand"><span className="brand-mark">P</span><span>PLAIONN<small>HOCKEY NETWORK</small></span></Link><div className="auth-heading"><p className="eyebrow">YOUR HOCKEY NETWORK</p><h1>Your next season starts here.</h1><p>Sign in to access your league and teams.</p></div>{error && <p role="alert">The confirmation link could not be verified. Try signing in or request a new confirmation through registration.</p>}<AuthForm/><p className="auth-footer">PLAIONN Hockey Network · Client preview</p></main></div>;
}

