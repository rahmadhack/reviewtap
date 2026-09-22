import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

export default async function QRRedirectPage({
  params,
}: Props) {
  await connection();

  const { code } = await params;

  const supabase = await createClient();

  // =========================================================
  // 1. CARI QR CARD
  // =========================================================

  const {
    data: qrCard,
    error: qrError,
  } = await supabase
    .from("qr_cards")
    .select(
      `
        id,
        code,
        status,
        business_id,
        google_place_id
      `
    )
    .eq("code", code)
    .maybeSingle();

  if (qrError) {
    console.error("QR lookup error:", qrError);
  }

  // =========================================================
  // 2. QR TIDAK DITEMUKAN
  // =========================================================

  if (!qrCard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR Tidak Ditemukan
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Kode QR: {code}
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 3. SCAN PERTAMA
  //
  // QR masih kosong → masuk halaman setup
  // =========================================================

  if (
    qrCard.status === "empty" &&
    !qrCard.business_id
  ) {
    redirect(
      `/q/${encodeURIComponent(code)}/setup`
    );
  }

  // =========================================================
  // 4. QR BELUM AKTIF
  // =========================================================

  if (
    qrCard.status !== "active" ||
    !qrCard.business_id
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR Tidak Aktif
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            QR Code ini belum aktif atau sudah
            dinonaktifkan.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 5. QR SUDAH AKTIF
  //
  // Ambil data bisnis
  // =========================================================

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select(
      `
        id,
        name,
        google_review_url
      `
    )
    .eq("id", qrCard.business_id)
    .maybeSingle();

  if (businessError) {
    console.error(
      "QR business error:",
      businessError
    );
  }

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Bisnis Tidak Ditemukan
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            QR sudah aktif tetapi bisnis yang
            terhubung tidak ditemukan.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 6. CATAT SCAN
  // =========================================================

  try {
    const requestHeaders = await headers();

    const userAgent =
      requestHeaders.get("user-agent") || null;

    const { error: scanError } =
      await supabase.rpc(
        "record_qr_scan",
        {
          p_code: code,
          p_user_agent: userAgent,
        }
      );

    if (scanError) {
      console.error(
        "Gagal mencatat scan QR:",
        scanError
      );
    }
  } catch (error) {
    console.error(
      "QR scan tracking error:",
      error
    );
  }

  // =========================================================
  // 7. BUAT URL GOOGLE REVIEW
  //
  // PRIORITAS:
  // google_place_id → halaman tulis review langsung
  //
  // FALLBACK:
  // google_review_url
  // =========================================================

  let googleReviewUrl = "";

  if (qrCard.google_place_id) {
    googleReviewUrl =
      `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
        qrCard.google_place_id
      )}`;
  } else if (business.google_review_url) {
    googleReviewUrl =
      business.google_review_url.trim();
  }

  // =========================================================
  // 8. GOOGLE REVIEW BELUM TERSEDIA
  // =========================================================

  if (!googleReviewUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR Belum Siap
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            QR sudah aktif, tetapi Google Review
            belum dikonfigurasi.
          </p>

          <p className="mt-4 text-xs text-gray-400">
            Silakan konfigurasi Google Place ID
            terlebih dahulu.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 9. SCAN KEDUA
  //
  // LANGSUNG KE HALAMAN TULIS REVIEW GOOGLE
  // =========================================================

  redirect(googleReviewUrl);
}