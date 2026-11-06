import Link from "next/link";
import {Navigation} from "@/components/navigation";
import {getVerifiedSession} from "@/lib/supabase/session";
export default async function PortalLayout({children}:Readonly<{children:React.ReactNode}>){
 await getVerifiedSession();
 return <><a className="skip-link" href="#main">Skip to content</a><div className="app-shell"><aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PLAIONN<small>HOCKEY NETWORK</small></span></Link><p className="nav-label">THE PLATFORM</p><Navigation/><div className="sidebar-note"><strong>Phase 1 preview</strong><p>League operations first.<br/>Every moment follows.</p></div></aside><div><header className="topbar"><Link className="mobile-brand" href="/">PLAIONN</Link><span>PLAIONN HOCKEY NETWORK</span><Link className="button" href="/account">My account</Link></header><div className="notice">Client preview - use test data to explore league management, registration, scheduling, and scoring.</div><main id="main" tabIndex={-1}>{children}</main><footer>PLAIONN Hockey Network · Client preview</footer></div></div></>;
}
