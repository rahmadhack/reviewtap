import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  const { code } = await context.params;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "resolve_qr_card",
    {
      p_code: code,
    }
  );

  if (error) {
    console.error("QR resolve error:", error);

    return NextResponse.redirect(
      new URL("/auth/error", request.url)
    );
  }

  const qrCard = data?.[0];

  if (!qrCard) {
    return NextResponse.redirect(
      new URL("/auth/error", request.url)
    );
  }

  // QR belum diaktifkan
  if (qrCard.status === "empty") {
    return NextResponse.redirect(
      new URL(`/activate/${encodeURIComponent(code)}`, request.url)
    );
  }

  // QR dinonaktifkan
  if (qrCard.status === "disabled") {
    return NextResponse.redirect(
      new URL("/auth/error", request.url)
    );
  }

  // QR aktif dan memiliki Google Review URL
  if (
    qrCard.status === "active" &&
    qrCard.google_review_url
  ) {
    return NextResponse.redirect(
      qrCard.google_review_url
    );
  }

  // Pengaman jika data QR tidak sesuai
  return NextResponse.redirect(
    new URL("/auth/error", request.url)
  );
}