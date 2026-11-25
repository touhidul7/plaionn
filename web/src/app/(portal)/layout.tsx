import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { SponsorBanner } from "@/components/sponsor-banner";
import { PortalShell } from "@/components/portal-shell";
import { getLeagueContext } from "@/lib/supabase/session";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { league } = await getLeagueContext();
  const isPlatform = league.id === "platform";

  return (
    <PortalShell
      isPlatform={isPlatform}
      header={<PublicHeader />}
      footer={<PublicFooter leagueName={league.name} />}
      sponsor={<SponsorBanner />}
    >
      {children}
    </PortalShell>
  );
}
