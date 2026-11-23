import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase, user } = await getVerifiedSession();

    let exportData: any = null;
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
        supabase.from("players").select("id, display_name, created_at").eq("owner_user_id", user.id).maybeSingle(),
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
    return new NextResponse(
      JSON.stringify({ error: true, message: err?.message || "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
