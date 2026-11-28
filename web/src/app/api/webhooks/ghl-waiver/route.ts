import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { INTERNAL_EXPIRES_AT, WAIVER_SIGNED_TITLE } from "@/lib/roster-invites";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const registrationId = body.registrationId || body.registration_id || body.customData?.registrationId;
    const status = String(body.status || "signed").toLowerCase();

    if (!registrationId) {
      return NextResponse.json(
        { success: false, message: "Missing registrationId in GHL webhook payload." },
        { status: 400 }
      );
    }

    if (status !== "signed" && status !== "completed" && status !== "true") {
      return NextResponse.json(
        { success: false, message: "Waiver not marked signed." },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const { data: reg } = await db
      .from("player_registrations")
      .select("id, league_id, season_id, user_id, player_id")
      .eq("id", registrationId)
      .maybeSingle();

    if (!reg) {
      return NextResponse.json(
        { success: false, message: "Registration record not found." },
        { status: 404 }
      );
    }

    await db.from("league_announcements").insert({
      league_id: reg.league_id,
      season_id: reg.season_id,
      author_id: reg.user_id,
      title: WAIVER_SIGNED_TITLE,
      message: JSON.stringify({
        registrationId: reg.id,
        playerId: reg.player_id,
        userId: reg.user_id,
        signedAt: new Date().toISOString(),
        source: "ghl_webhook",
      }),
      priority: "standard",
      is_pinned: false,
      expires_at: INTERNAL_EXPIRES_AT,
    });

    return NextResponse.json({
      success: true,
      message: "GHL waiver signature confirmed and recorded.",
      registrationId: reg.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Invalid webhook payload." },
      { status: 500 }
    );
  }
}
