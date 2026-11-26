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
  const { league, supabase } = await getLeagueContext();
  const isPlatform = league.id === "platform";

  let themeColor: string | null = null;
  if (!isPlatform && league.id) {
    try {
      const { data: settings } = await supabase
        .from("season_settings")
        .select("currency")
        .eq("league_id", league.id)
        .limit(1);
      if (settings && settings[0]?.currency?.startsWith("#")) {
        themeColor = settings[0].currency;
      }
    } catch {
      // Fallback to default styling
    }
  }

  return (
    <PortalShell
      isPlatform={isPlatform}
      themeColor={themeColor}
      header={<PublicHeader />}
      footer={<PublicFooter leagueName={league.name} />}
      sponsor={<SponsorBanner />}
    >
      {children}
    </PortalShell>
  );
}
