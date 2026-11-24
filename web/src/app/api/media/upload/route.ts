import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop() || "mp4";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const serviceDb = createServiceClient();
    const { error } = await serviceDb.storage
      .from("game-videos")
      .upload(fileName, buffer, {
        contentType: file.type || "video/mp4",
        upsert: true,
      });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const { data: publicUrlData } = serviceDb.storage.from("game-videos").getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      fileName,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
