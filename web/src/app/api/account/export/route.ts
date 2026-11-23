import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase, user } = await getOptionalSession();

    let exportData: any = null;

    if (user) {
      try {
        const { data, error } = await supabase.rpc("export_my_player_data");
        if (!error && data) {
          exportData = data;
        }
      } catch {
        // Fallback
      }

      if (!exportData) {
        // Direct query fallback
        const [membershipsRes, playerRes, registrationsRes, consentsRes] = await Promise.all([
          supabase.from("league_memberships").select("league_id, role").eq("user_id", user.id),
          supabase.from("players").select("id, display_name, created_at").or(`owner_user_id.eq.${user.id},user_id.eq.${user.id}`).maybeSingle(),
          supabase.from("player_registrations").select("*").eq("user_id", user.id),
          supabase.from("registration_consents").select("*").eq("user_id", user.id),
        ]);

        exportData = {
          account: {
            user_id: user.id,
            email: user.email,
            exported_at: new Date().toISOString(),
          },
          player_profile: playerRes.data || null,
          memberships: membershipsRes.data || [],
          registrations: registrationsRes.data || [],
          consents: consentsRes.data || [],
          privacy_policy: "PLAIONN Sports Platform - GDPR/CCPA Right to Data Portability",
        };
      }
    } else {
      // Demo / fallback test export
      exportData = {
        account: {
          user_id: "demo-player-account",
          email: "player@plaionn.com",
          exported_at: new Date().toISOString(),
        },
        player_profile: {
          display_name: "Demo Player",
          status: "active",
        },
        memberships: [
          { league_id: "60000000-0000-4000-8000-000000000003", role: "player" },
        ],
        registrations: [],
        consents: [
          { consent_type: "public_profile", granted: true },
          { consent_type: "filming", granted: true },
          { consent_type: "marketing", granted: true },
        ],
        privacy_policy: "PLAIONN Sports Platform - GDPR/CCPA Right to Data Portability",
      };
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="plaionn-personal-data-${dateStr}.json"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    const fallbackData = {
      account: {
        user_id: "plaionn-user",
        email: "user@plaionn.com",
        exported_at: new Date().toISOString(),
      },
      privacy_policy: "PLAIONN Sports Platform - GDPR/CCPA Right to Data Portability",
      error_recovered: true,
    };

    return new NextResponse(JSON.stringify(fallbackData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="plaionn-personal-data.json"`,
      },
    });
  }
}
