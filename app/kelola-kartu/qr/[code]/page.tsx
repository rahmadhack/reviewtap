import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/server";
import QRResetForm from "./QRResetForm";

const OWNER_USER_ID = "6254768d-5805-41e3-8f03-b168081f9102";
const OWNER_ORGANIZATION_ID = "2a3a6d01-73ac-4656-b8e7-2c4208593362";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function QRViewPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login");
  }

  const { data: qrCard, error } = await supabase
    .from("qr_cards")
    .select(
      "id, serial_number, code, status, business_id, google_place_id, organization_id, reseller_user_id, destination_type, custom_link_url"
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("QR card lookup error:", error);
  }

  if (!qrCard) {
    notFound();
  }

  const isOwner = user.id === OWNER_USER_ID;
  let hasAccess = false;

  if (isOwner) {
    hasAccess = qrCard.organization_id === OWNER_ORGANIZATION_ID;
  } else if (qrCard.reseller_user_id === user.id) {
    const {
      data: memberships,
      error: membershipError,
    } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "reseller")
      .eq("organization_id", qrCard.organization_id)
      .limit(2);

    if (membershipError) {
      console.error("QR detail membership error:", membershipError);
    } else {
      hasAccess = memberships?.length === 1;
    }
  }

  if (!hasAccess) {
    notFound();
  }

  const destinationType =
    qrCard.destination_type || "google_review";
  const isCustomLink = destinationType === "custom_link";

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host");

  const forwardedProtocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();

  const protocol =
    forwardedProtocol ||
    (host?.includes("localhost") ? "http" : "https");

  const baseUrl = host
    ? `${protocol}://${host}`
    : "https://reviewtap-chi.vercel.app";

  // Barcode selalu menggunakan URL QR yang sama.
  // Pemilihan tujuan dilakukan oleh halaman /q/[code].
  
  const qrTargetUrl =
    qrCard.destination_type === "custom_link"
    ? `${baseUrl}/q/${encodeURIComponent(qrCard.code)}/setup-custom`
    : `${baseUrl}/q/${encodeURIComponent(qrCard.code)}/setup`;

  const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
    width: 800,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  const setupUrl = isCustomLink
    ? `${baseUrl}/q/${encodeURIComponent(qrCard.code)}/setup-custom`
    : `${baseUrl}/q/${encodeURIComponent(qrCard.code)}/setup`;

  const isActive = qrCard.status === "active";
  const isEmpty = qrCard.status === "empty";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <a
            href={isCustomLink ? "/custom-link" : "/kelola-kartu"}
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Kembali ke {isCustomLink ? "Custom Link" : "Kelola Kartu"}
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {isCustomLink ? "QR Custom Link" : "QR Card"}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {qrCard.serial_number}
            </h1>

            <p className="mt-1 font-mono text-sm text-slate-500">
              {qrCard.code}
            </p>
          </div>

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

            <div className="mt-6 text-center">
              {isActive ? (
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Aktif
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Belum Aktif
                </span>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              {isActive ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    QR aktif
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {isCustomLink
                      ? "QR ini aktif dan akan mengarahkan pengunjung ke URL Custom Link yang tersimpan."
                      : "QR ini sudah terhubung dan siap digunakan pelanggan untuk menuju Google Review."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    QR siap dicetak
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Cetak QR ini terlebih dahulu. Saat dipindai, QR akan
                    membuka halaman aktivasi yang sesuai.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {isCustomLink
                      ? "QR ini akan membuka halaman aktivasi Custom Link untuk memasukkan URL tujuan dan PIN."
                      : "Setelah aktivasi selesai, QR yang sama akan mengarahkan pelanggan ke Google Review."}
                  </p>
                </>
              )}
            </div>

            {isCustomLink && isActive && qrCard.custom_link_url && (
              <div className="mt-5">
                <p className="text-xs font-medium text-slate-400">
                  URL tujuan Custom Link
                </p>
                <div className="mt-2 rounded-xl bg-slate-50 p-3">
                  <p className="break-all font-mono text-xs leading-5 text-slate-600">
                    {qrCard.custom_link_url}
                  </p>
                </div>
              </div>
            )}

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

            <div className="mt-6 grid grid-cols-2 gap-3">
              <a
                href={qrDataUrl}
                download={`${qrCard.code}.png`}
                className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Download QR
              </a>

              <a
                href={isEmpty ? setupUrl : qrTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Tes QR
              </a>
            </div>

            {!isCustomLink && isActive && (
              <QRResetForm code={qrCard.code} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}