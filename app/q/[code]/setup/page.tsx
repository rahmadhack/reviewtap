import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * Setup QR membutuhkan user yang memiliki akses
   * owner/admin pada organisasi.
   */
  if (!user) {
    redirect(
      `/auth/login?next=/q/${encodeURIComponent(code)}/setup`
    );
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            Terjadi kesalahan
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {membershipError.message}
          </p>
        </div>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Tidak memiliki akses
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Anda tidak memiliki izin untuk mengaktifkan QR
            Code.
          </p>
        </div>
      </main>
    );
  }

  /*
   * Ambil QR berdasarkan code.
   */
  const { data: qrCard, error: qrError } = await supabase
    .from("qr_cards")
    .select(
      "id, serial_number, code, status, business_id, activated_at"
    )
    .eq("code", code)
    .maybeSingle();

  if (qrError) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            Gagal membaca QR
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {qrError.message}
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

  /*
   * Kalau QR sudah aktif, jangan tampilkan setup lagi.
   */
  if (qrCard.status === "active") {
    redirect(`/q/${code}`);
  }

  /*
   * Hanya QR empty tanpa business yang boleh diaktifkan.
   */
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
            QR Code ini bukan dalam status kosong atau sudah
            terhubung dengan bisnis.
          </p>
        </div>
      </main>
    );
  }

  /*
   * Ambil daftar bisnis organisasi sebagai informasi tambahan.
   * Tidak digunakan untuk autocomplete Google.
   */
  const { data: businesses } = await supabase
    .from("businesses")
    .select(
      "id, name, address, phone, google_review_url, google_place_id"
    )
    .eq("organization_id", membership.organization_id)
    .order("name", { ascending: true });

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
            Pilih bisnis Google yang akan terhubung dengan
            kartu ini.
          </p>
        </div>

        <QRSetupForm
          code={qrCard.code}
          serialNumber={qrCard.serial_number}
          organizationId={membership.organization_id}
          existingBusinesses={businesses || []}
        />
      </div>
    </main>
  );
}