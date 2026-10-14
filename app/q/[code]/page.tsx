
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function QRRedirectPage({ params }: Props) {
  await connection();

  const { code } = await params;
  const supabase = await createClient();

  const { data: qrCard, error: qrError } = await supabase
    .from("qr_cards")
    .select(
      "id, code, status, business_id, google_place_id, destination_type, custom_link_url"
    )
    .eq("code", code)
    .maybeSingle();

    console.log("QR lookup debug:", {
  code,
  found: Boolean(qrCard),
  error: qrError?.message ?? null,
});

  if (qrError) {
    console.error("QR lookup error:", qrError);
  }

  if (!qrCard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR Tidak Ditemukan
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Kode QR ini tidak terdaftar.
          </p>
        </div>
      </main>
    );
  }

  const destinationType = qrCard.destination_type || "google_review";

  // QR Custom Link yang belum aktif diarahkan ke halaman setup khusus.
  if (
    destinationType === "custom_link" &&
    qrCard.status === "empty" &&
    !qrCard.business_id
  ) {
    redirect(`/q/${encodeURIComponent(code)}/setup-custom`);
  }

  // QR Google Review yang belum aktif tetap memakai halaman setup lama.
  if (
    destinationType !== "custom_link" &&
    qrCard.status === "empty" &&
    !qrCard.business_id
  ) {
    redirect(`/q/${encodeURIComponent(code)}/setup`);
  }

  if (qrCard.status !== "active") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR Tidak Aktif
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            QR ini sedang tidak aktif.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // Custom Link: catat scan lalu arahkan ke URL tersimpan.
  // =========================================================
  if (destinationType === "custom_link") {
    const destinationUrl = qrCard.custom_link_url?.trim();

    if (!destinationUrl) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              Custom Link Belum Siap
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              URL tujuan untuk QR ini belum tersedia.
            </p>
          </div>
        </main>
      );
    }

    // Validasi ulang URL sebelum redirect.
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(destinationUrl);
    } catch {
      return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              URL Tujuan Tidak Valid
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Hubungi pemilik QR untuk memperbaiki tautan.
            </p>
          </div>
        </main>
      );
    }

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              Protokol URL Tidak Diizinkan
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              URL tujuan harus menggunakan HTTP atau HTTPS.
            </p>
          </div>
        </main>
      );
    }

    try {
      const requestHeaders = await headers();
      const userAgent = requestHeaders.get("user-agent") || null;

      const { error: scanError } = await supabase.rpc(
        "record_qr_scan",
        {
          p_code: code,
          p_user_agent: userAgent,
        }
      );

      if (scanError) {
        console.error("Custom Link scan record error:", scanError);
      }
    } catch (error) {
      console.error("Custom Link scan logging error:", error);
    }

    redirect(parsedUrl.href);
  }

  // =========================================================
  // Google Review: alur lama dipertahankan.
  // =========================================================
  if (!qrCard.business_id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Bisnis Tidak Ditemukan
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            QR ini belum terhubung dengan bisnis.
          </p>
        </div>
      </main>
    );
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, google_review_url")
    .eq("id", qrCard.business_id)
    .maybeSingle();

  if (businessError) {
    console.error("QR business lookup error:", businessError);
  }

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Bisnis Tidak Ditemukan
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Data bisnis untuk QR ini tidak ditemukan.
          </p>
        </div>
      </main>
    );
  }

  try {
    const requestHeaders = await headers();
    const userAgent = requestHeaders.get("user-agent") || null;

    await supabase.rpc("record_qr_scan", {
      p_code: code,
      p_user_agent: userAgent,
    });
  } catch (error) {
    console.error("QR scan logging error:", error);
  }

  let googleReviewUrl = "";

  if (qrCard.google_place_id) {
    googleReviewUrl =
      `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
        qrCard.google_place_id
      )}`;
  } else if (business.google_review_url) {
    googleReviewUrl = business.google_review_url.trim();
  }

  if (!googleReviewUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR Belum Siap
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Tautan Google Review belum tersedia.
          </p>
        </div>
      </main>
    );
  }

  redirect(googleReviewUrl);
}
