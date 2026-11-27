import { cookies } from "next/headers";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { SponsorBanner } from "@/components/sponsor-banner";
import { PortalShell } from "@/components/portal-shell";
import { getLeagueContext } from "@/lib/supabase/session";
import { createServiceClient } from "@/lib/supabase/admin";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { league, supabase } = await getLeagueContext();
  const isPlatform = league.id === "platform";

  let themeColor: string | null = null;

  // Query league-specific theme record strictly for this active league (never platform)
  if (!isPlatform && league.id && league.id !== "platform") {
    try {
      let db: any;
      try {
        db = createServiceClient();
      } catch {
        db = supabase;
      }

      const { data: themeRec } = await db
        .from("league_announcements")
        .select("message")
        .eq("league_id", league.id)
        .eq("title", "__LEAGUE_THEME__")
        .order("created_at", { ascending: false })
        .limit(1);

      if (themeRec && themeRec[0]?.message) {
        const parsed = JSON.parse(themeRec[0].message);
        if (parsed.primaryColor && parsed.primaryColor.startsWith("#")) {
          themeColor = parsed.primaryColor;
        }
      }

      if (!themeColor) {
        const { data: settings } = await db
          .from("season_settings")
          .select("currency")
          .eq("league_id", league.id)
          .limit(1);
        if (settings && settings[0]?.currency?.startsWith("#")) {
          themeColor = settings[0].currency;
        }
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
