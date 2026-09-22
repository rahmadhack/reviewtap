import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BusinessSearch from "./BusinessSearch";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function ActivateQRPage({ params }: PageProps) {
  const { code } = await params;
  const supabase = await createClient();
  
  const { data: businesses, error: businessesError } =
  await supabase
    .from("businesses")
    .select(
      "id, name, address, google_review_url",
    )
    .order("name", { ascending: true });
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase.rpc("resolve_qr_card", {
    p_code: code,
  });

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    console.error("QR activation lookup error:", error);

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
              <svg
                className="h-8 w-8 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
              Terjadi Kesalahan
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              QR Code tidak dapat diperiksa saat ini. Silakan coba kembali
              beberapa saat lagi.
            </p>

            <a
              href="/dashboard"
              className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Kembali ke Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  const qrCard = data?.[0];

  // ============================================================
  // QR TIDAK DITEMUKAN
  // ============================================================

  if (!qrCard) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg
                className="h-8 w-8 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 7h18" />
                <path d="M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
                <path d="M9 11h6" />
                <path d="M9 15h4" />
              </svg>
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
              QR Code Tidak Ditemukan
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              QR Code yang Anda akses tidak terdaftar di sistem ReviewTap.
            </p>

            <a
              href="/dashboard"
              className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Kembali ke Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // QR SUDAH AKTIF
  // ============================================================

  if (qrCard.status === "active") {
    redirect(`/q/${encodeURIComponent(code)}`);
  }

  // ============================================================
  // QR DINONAKTIFKAN
  // ============================================================

  if (qrCard.status === "disabled") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
              <svg
                className="h-8 w-8 text-amber-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M8 8l8 8" />
                <path d="M16 8l-8 8" />
              </svg>
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
              QR Code Dinonaktifkan
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              QR Code ini sedang tidak tersedia untuk digunakan. Silakan
              hubungi administrator atau pemilik QR Code.
            </p>

            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                QR Code
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
                {code}
              </p>
            </div>

            <a
              href="/dashboard"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Kembali ke Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================
  // QR EMPTY / BELUM DIAKTIFKAN
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
              <svg
                className="h-5 w-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h6v6H4z" />
                <path d="M14 4h6v6h-6z" />
                <path d="M4 14h6v6H4z" />
                <path d="M14 14h2" />
                <path d="M20 14v6" />
                <path d="M14 20h2" />
              </svg>
            </div>

            <div>
              <p className="text-base font-bold tracking-tight text-slate-900">
                ReviewTap
              </p>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                Smart Review QR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">
              QR Tersedia
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Intro */}
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 shadow-lg shadow-slate-900/10">
              <svg
                className="h-8 w-8 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4h6v6H4z" />
                <path d="M14 4h6v6h-6z" />
                <path d="M4 14h6v6H4z" />
                <path d="M14 14h2" />
                <path d="M20 14v6" />
                <path d="M14 20h2" />
              </svg>
            </div>

            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Aktivasi QR Code
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Hubungkan QR ke Bisnis Anda
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              Pilih bisnis yang ingin dihubungkan dengan QR Code ini. Setelah
              diaktifkan, pelanggan dapat langsung diarahkan ke halaman review
              Google bisnis Anda.
            </p>
          </div>

          {/* QR Info */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <svg
                  className="h-6 w-6 text-slate-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 4h6v6H4z" />
                  <path d="M14 4h6v6h-6z" />
                  <path d="M4 14h6v6H4z" />
                  <path d="M14 14h2" />
                  <path d="M20 14v6" />
                  <path d="M14 20h2" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  QR Code
                </p>

                <p className="mt-0.5 truncate font-mono text-base font-bold text-slate-900">
                  {code}
                </p>
              </div>

              <div className="hidden rounded-full bg-emerald-50 px-3 py-1.5 sm:block">
                <span className="text-xs font-semibold text-emerald-700">
                  Belum Diaktifkan
                </span>
              </div>
            </div>
          </div>

          {/* Activation Card */}
          <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
            <div className="p-6 sm:p-8">
              {/* Section Header */}
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Cari Bisnis
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Cari dan pilih bisnis yang akan terhubung dengan QR Code.
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="mt-7">
                <label
                  htmlFor="business-search"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Nama bisnis atau lokasi
                </label>
                <BusinessSearch
                code={code}
                businesses={businesses ?? []}
                />
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <svg
                      className="h-5 w-5 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                </svg>
                  </div>
                </div>
                
             </div>

              {/* Example Preview */}
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contoh hasil
                </p>

                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
                      <svg
                        className="h-5 w-5 text-red-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        Warung Maju Jaya
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        Contoh lokasi bisnis · Indonesia
                      </p>
                    </div>

                    <div className="hidden rounded-lg bg-slate-100 px-3 py-2 sm:block">
                      <span className="text-xs font-medium text-slate-500">
                        Contoh
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activate Button */}
              <div className="mt-7">
                <button
                  type="button"
                  disabled
                  className="flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-200 px-5 text-sm font-bold text-slate-400"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 3v18" />
                    <path d="M3 12h18" />
                  </svg>

                  Pilih Bisnis Terlebih Dahulu
                </button>
              </div>

              {/* Security Note */}
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>

                <p className="text-xs leading-5 text-slate-500">
                  QR Code ini akan tetap menggunakan alamat QR yang sama.
                  Setelah bisnis diaktifkan, tujuan QR akan diarahkan ke
                  halaman review bisnis yang dipilih.
                </p>
              </div>
            </div>
          </section>

          {/* Steps */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                1
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">
                Cari bisnis
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Temukan bisnis Anda.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                2
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">
                Pilih lokasi
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Pastikan bisnis yang dipilih benar.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                3
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800">
                Aktifkan QR
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                QR siap digunakan pelanggan.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="pb-8 pt-8 text-center">
            <p className="text-xs text-slate-400">
              Powered by{" "}
              <span className="font-semibold text-slate-500">ReviewTap</span>
            </p>

            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {code}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}