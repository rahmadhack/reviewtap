import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function QRViewPage({
  params,
}: PageProps) {
  const { code } = await params;

  const supabase = await createClient();

  const { data: qrCard, error } = await supabase
    .from("qr_cards")
    .select(
      `
        id,
        serial_number,
        code,
        status,
        business_id,
        google_place_id
      `
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("QR card lookup error:", error);
  }

  if (!qrCard) {
    notFound();
  }

  // =========================================================
  // URL PERMANEN DI DALAM QR
  //
  // QR FISIK SELALU MENGARAH KE:
  //
  // https://reviewtap.com/q/RT-000001
  //
  // BUKAN langsung ke Google Review.
  //
  // Scan pertama:
  // /q/[code] -> /q/[code]/setup
  //
  // Scan berikutnya:
  // /q/[code] -> Google Review
  // =========================================================

  const requestHeaders = await headers();

  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host");

  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    "http";

  const baseUrl = host
    ? `${protocol}://${host}`
    : "https://reviewtap.com";

  const qrTargetUrl =
    `${baseUrl}/q/${encodeURIComponent(qrCard.code)}`;

  // =========================================================
  // GENERATE QR
  // =========================================================

  const qrDataUrl = await QRCode.toDataURL(
    qrTargetUrl,
    {
      width: 800,
      margin: 2,
      errorCorrectionLevel: "H",
    }
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-xl">

        {/* BACK */}

        <div className="mb-6">
          <a
            href="/kelola-kartu"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Kembali ke Kelola Kartu
          </a>
        </div>

        {/* MAIN CARD */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* HEADER */}

          <div className="border-b border-slate-100 p-6 text-center">

            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              QR Card
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {qrCard.serial_number}
            </h1>

            <p className="mt-1 font-mono text-sm text-slate-500">
              {qrCard.code}
            </p>

          </div>

          {/* QR */}

          <div className="p-6">

            <div className="flex justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <img
                  src={qrDataUrl}
                  alt={`QR Code ${qrCard.code}`}
                  width={500}
                  height={500}
                  className="h-auto w-full max-w-[360px]"
                />
              </div>
            </div>

            {/* STATUS */}

            <div className="mt-6 text-center">

              {qrCard.status === "active" ? (
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Aktif
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Kosong
                </span>
              )}

            </div>

            {/* INFO */}

            <div className="mt-6 rounded-xl bg-slate-50 p-4">

              {qrCard.status === "active" ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    QR aktif
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    QR ini sudah terhubung dengan
                    Google Business dan siap digunakan
                    pelanggan untuk menuju Google Review.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    QR siap dicetak
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Cetak QR ini terlebih dahulu. Saat
                    pertama kali dipindai, QR akan
                    membuka halaman aktivasi untuk
                    menghubungkan Google Business dan PIN.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Setelah aktivasi selesai, QR yang
                    sama akan otomatis mengarahkan
                    pelanggan ke Google Review.
                  </p>
                </>
              )}

            </div>

            {/* QR URL */}

            <div className="mt-5">

              <p className="text-xs font-medium text-slate-400">
                URL di dalam QR
              </p>

              <div className="mt-2 rounded-xl bg-slate-50 p-3">
                <p className="break-all font-mono text-xs leading-5 text-slate-600">
                  {qrTargetUrl}
                </p>
              </div>

            </div>

            {/* ACTIONS */}

            <div className="mt-6 grid grid-cols-2 gap-3">

              <a
                href={qrDataUrl}
                download={`${qrCard.code}.png`}
                className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Download QR
              </a>

              <a
                href={qrTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tes QR
              </a>

            </div>

          </div>

        </div>

      </div>
    </main>
  );
}