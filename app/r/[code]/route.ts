import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ code: string }>;
  }
) {
  try {
    const { code } = await context.params;

    const supabase = await createClient();

    const { data: reviewLink, error } = await supabase
      .from("review_links")
      .select("id, destination_url, is_active")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Review link error:", error);

      return NextResponse.json(
        {
          error: "Gagal mengambil QR Code.",
        },
        { status: 500 }
      );
    }

    if (!reviewLink) {
      return NextResponse.json(
        {
          error: "QR Code tidak ditemukan atau sudah tidak aktif.",
        },
        { status: 404 }
      );
    }

    return NextResponse.redirect(reviewLink.destination_url);
  } catch (error) {
    console.error("Redirect error:", error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan server.",
      },
      { status: 500 }
    );
  }
}