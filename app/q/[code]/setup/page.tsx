import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import QRSetupForm from "./QRSetupForm";

type PageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function QRSetupPage({
  params,
}: PageProps) {
  const { code } = await params;

  const supabase = createAdminClient();

  // =========================================================
  // 1. Cari QR berdasarkan code
  // =========================================================
  const {
    data: qrCard,
    error: qrError,
  } = await supabase
    .from("qr_cards")
    .select(
      `
        id,
        serial_number,
        code,
        status,
        business_id,
        organization_id,
        activated_at
      `,
    )
    .eq("code", code)
    .maybeSingle();

  // =========================================================
  // 2. QR tidak ditemukan / gagal dibaca
  // =========================================================
  if (qrError) {
    console.error(
      "QR setup lookup error:",
      qrError,
    );

    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            Gagal membaca QR
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            QR Code tidak dapat diperiksa.
          </p>
        </div>
      </main>
    );
  }

  if (!qrCard) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            QR Code tidak ditemukan
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Kode QR "{code}" tidak terdaftar.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 3. QR yang sudah aktif langsung ke halaman review
  // =========================================================
  if (qrCard.status === "active") {
    redirect(`/q/${code}`);
  }

  // =========================================================
  // 4. Hanya QR empty yang boleh setup
  // =========================================================
  if (
    qrCard.status !== "empty" ||
    qrCard.business_id !== null
  ) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            QR tidak dapat diaktifkan
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            QR Code ini tidak tersedia untuk setup.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 5. QR harus memiliki organization_id
  // =========================================================
  if (!qrCard.organization_id) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            QR belum siap digunakan
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            QR Code ini belum memiliki organisasi.
            Silakan hubungi Admin.
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // 6. Tampilkan form setup langsung
  //
  // Tidak ada:
  // - login
  // - auth check
  // - membership check
  // - organization selector
  // =========================================================
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white">
            QR
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Aktifkan Kartu
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Hubungkan kartu ini dengan Google Business Anda.
          </p>
        </div>

        <QRSetupForm
          code={qrCard.code}
          serialNumber={qrCard.serial_number}
        />
      </div>
    </main>
  );
}