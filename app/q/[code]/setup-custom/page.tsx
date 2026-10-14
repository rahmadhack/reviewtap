
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import CustomLinkSetupForm from "./CustomLinkSetupForm";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function CustomLinkSetupPage({ params }: Props) {
  await connection();

  const { code } = await params;
  const supabase = createAdminClient();

  const { data: qrCard, error } = await supabase
    .from("qr_cards")
    .select(
      "id, code, serial_number, status, business_id, destination_type, custom_link_url"
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("Custom Link setup lookup error:", error);
    throw new Error("Gagal membaca data QR Custom Link.");
  }

  if (!qrCard) {
    notFound();
  }

  if (qrCard.destination_type !== "custom_link") {
    notFound();
  }

  // QR aktif diarahkan ke halaman QR agar pengguna dapat melihat
  // status aktivasi dan tujuan yang sudah tersimpan.
  if (qrCard.status === "active") {
    redirect(`/q/${encodeURIComponent(code)}`);
  }

  if (qrCard.status !== "empty" || qrCard.business_id !== null) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            QR Tidak Dapat Diaktifkan
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Status QR ini tidak memenuhi syarat untuk aktivasi Custom Link.
          </p>
          <Link
            href="/custom-link"
            className="mt-5 inline-block text-blue-600 hover:underline"
          >
            Kembali ke Custom Link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/custom-link"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Kembali ke Custom Link
        </Link>

        <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Aktifkan Custom Link
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Masukkan alamat tujuan yang akan dibuka saat QR dipindai.
          </p>

          <div className="mt-5 rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Nomor kartu</p>
            <p className="mt-1 font-semibold text-gray-900">
              {qrCard.serial_number}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Kode: {qrCard.code}
            </p>
          </div>

          <CustomLinkSetupForm
            code={qrCard.code}
            serialNumber={qrCard.serial_number}
          />
        </div>
      </div>
    </main>
  );
}
