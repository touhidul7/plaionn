import { NextRequest, NextResponse } from "next/server";
import { getLeagueContext } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueIdParam = searchParams.get("leagueId");

  const { supabase, league, canManage } = await getLeagueContext();
  const targetLeagueId = leagueIdParam || league.id;

  if (!canManage) {
    return new NextResponse("Unauthorized: commissioner access required for payroll export", {
      status: 403,
    });
  }

  const { data, error } = await supabase.rpc("get_officials_payroll_summary", {
    target_league: targetLeagueId,
  });

  if (error || !Array.isArray(data)) {
    return new NextResponse("Failed to compile payroll data", { status: 500 });
  }

  const header = [
    "Official Name",
    "Certification Level",
    "Total Games",
    "Referee Games",
    "Timekeeper Games",
    "Total Earned ($)",
    "Pending Payout ($)",
    "Paid ($)",
    "User ID",
  ];

  const rows = data.map((row: any) => {
    return [
      `"${(row.full_name || "Unknown").replace(/"/g, '""')}"`,
      `"${row.certification_level || "Standard"}"`,
      row.total_games || 0,
      row.referee_games || 0,
      row.timekeeper_games || 0,
      ((row.total_earned_cents || 0) / 100).toFixed(2),
      ((row.pending_cents || 0) / 100).toFixed(2),
      ((row.paid_cents || 0) / 100).toFixed(2),
      `"${row.user_id}"`,
    ].join(",");
  });

  const csvBody = [header.join(","), ...rows].join("\r\n") + "\r\n";

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="officials-payroll-${new Date().toISOString().split("T")[0]}.csv"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
