import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { SponsorBanner } from "@/components/sponsor-banner";
import { getLeagueContext } from "@/lib/supabase/session";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { league } = await getLeagueContext();

  return (
    <div className="public-portal-root">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <PublicHeader />
      <div className="public-portal-body">
        {children}
        <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", padding: "0 24px" }}>
          <SponsorBanner />
        </div>
      </div>
      <PublicFooter leagueName={league.name} />
    </div>
  );
}
