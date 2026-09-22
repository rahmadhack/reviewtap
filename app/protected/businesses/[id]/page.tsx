import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type ScanRow = {
  id: string;
  qr_card_id: string;
  business_id: string;
  scanned_at: string;
  user_agent: string | null;
};

type QRCard = {
  id: string;
  serial_number: string;
  code: string;
  status: string;
};

export default async function BusinessDetailPage({
  params,
}: Props) {
  await connection();

  const { id } = await params;

  const supabase = await createClient();

  // =========================
  // AUTH
  // =========================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // =========================
  // ORGANIZATION
  // =========================

  const { data: membership, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

  if (membershipError || !membership) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl bg-white p-8 shadow-sm">

            <h1 className="text-xl font-bold text-gray-900">
              Organisasi tidak ditemukan
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Akun Anda belum memiliki organisasi.
            </p>

          </div>

        </div>
      </main>
    );
  }

  const organizationId = membership.organization_id;

  // =========================
  // BUSINESS
  // =========================

  const { data: business, error: businessError } =
    await supabase
      .from("businesses")
      .select(
        "id, name, google_review_url, created_at, organization_id"
      )
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();

  if (businessError) {
    console.error(
      "Business detail error:",
      businessError
    );
  }

  if (!business) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl bg-white p-8 shadow-sm">

            <h1 className="text-xl font-bold text-gray-900">
              Bisnis tidak ditemukan
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Bisnis tersebut tidak ditemukan atau Anda tidak
              memiliki akses.
            </p>

            <Link
              href="/protected/businesses"
              className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Kembali ke Bisnis
            </Link>

          </div>

        </div>
      </main>
    );
  }

  // =========================
  // QR CARDS
  // =========================

  const { data: qrCards, error: qrError } =
    await supabase
      .from("qr_cards")
      .select(
        "id, serial_number, code, status"
      )
      .eq("business_id", business.id)
      .order("created_at", {
        ascending: false,
      });

  if (qrError) {
    console.error(
      "Business detail QR error:",
      qrError
    );
  }

  const qrList: QRCard[] = qrCards ?? [];

  // =========================
  // SCAN EVENTS
  // =========================

  const { data: scans, error: scanError } =
    await supabase
      .from("qr_scan_events")
      .select(
        "id, qr_card_id, business_id, scanned_at, user_agent"
      )
      .eq("business_id", business.id)
      .order("scanned_at", {
        ascending: false,
      });

  if (scanError) {
    console.error(
      "Business detail scan error:",
      scanError
    );
  }

  const scanRows: ScanRow[] = scans ?? [];

  // =========================
  // DATE
  // =========================

  const now = new Date();

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const start7Days = new Date(now);
  start7Days.setDate(
    start7Days.getDate() - 7
  );

  const start30Days = new Date(now);
  start30Days.setDate(
    start30Days.getDate() - 30
  );

  // =========================
  // STATS
  // =========================

  const totalScans = scanRows.length;

  const scansToday = scanRows.filter(
    (scan) =>
      new Date(scan.scanned_at) >=
      startToday
  ).length;

  const scans7Days = scanRows.filter(
    (scan) =>
      new Date(scan.scanned_at) >=
      start7Days
  ).length;

  const scans30Days = scanRows.filter(
    (scan) =>
      new Date(scan.scanned_at) >=
      start30Days
  ).length;

  const activeQRs = qrList.filter(
    (qr) => qr.status === "active"
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      <div className="mx-auto max-w-7xl">

        {/* =========================
            HEADER
        ========================= */}

        <div className="mb-8">

          <Link
            href="/protected/businesses"
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Kembali ke Bisnis
          </Link>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>

              <h1 className="text-3xl font-bold text-gray-900">
                {business.name}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Detail dan aktivitas bisnis.
              </p>

            </div>

            <Link
              href="/protected/analytics"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Lihat Analytics
            </Link>

          </div>

        </div>

        {/* =========================
            STATS
        ========================= */}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total Scan"
            value={totalScans}
            description="Semua aktivitas"
          />

          <StatCard
            title="Hari Ini"
            value={scansToday}
            description="Sejak pukul 00:00"
          />

          <StatCard
            title="7 Hari"
            value={scans7Days}
            description="Aktivitas 7 hari"
          />

          <StatCard
            title="30 Hari"
            value={scans30Days}
            description="Aktivitas 30 hari"
          />

        </div>

        {/* =========================
            INFORMATION
        ========================= */}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">

          {/* BUSINESS INFO */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-gray-900">
              Informasi Bisnis
            </h2>

            <div className="mt-5 space-y-5">

              <div>
                <p className="text-xs text-gray-500">
                  Nama Bisnis
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {business.name}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Google Review
                </p>

                {business.google_review_url ? (
                  <a
                    href={business.google_review_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all text-sm text-blue-600 hover:underline"
                  >
                    {business.google_review_url}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    Belum tersedia
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Dibuat
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  {new Date(
                    business.created_at
                  ).toLocaleDateString(
                    "id-ID",
                    {
                      dateStyle: "long",
                    }
                  )}
                </p>
              </div>

            </div>

          </div>

          {/* QR INFO */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <div className="flex items-start justify-between gap-4">

              <div>

                <h2 className="text-lg font-semibold text-gray-900">
                  QR Code
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  QR yang terhubung ke bisnis ini.
                </p>

              </div>

              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                {activeQRs.length} aktif
              </span>

            </div>

            <div className="mt-5 space-y-3">

              {qrList.length === 0 ? (

                <div className="rounded-xl border border-dashed p-6 text-center">

                  <p className="text-sm text-gray-500">
                    Belum ada QR untuk bisnis ini.
                  </p>

                </div>

              ) : (

                qrList.map((qr) => (

                  <div
                    key={qr.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >

                    <div>

                      <p className="font-medium text-gray-900">
                        {qr.code}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {qr.serial_number}
                      </p>

                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        qr.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {qr.status === "active"
                        ? "Aktif"
                        : qr.status}
                    </span>

                  </div>

                ))

              )}

            </div>

          </div>

        </div>

        {/* =========================
            RECENT ACTIVITY
        ========================= */}

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-5">

            <h2 className="text-lg font-semibold text-gray-900">
              Aktivitas Terbaru
            </h2>

            <p className="text-sm text-gray-500">
              10 scan terakhir untuk bisnis ini.
            </p>

          </div>

          {scanRows.length === 0 ? (

            <div className="rounded-xl border border-dashed p-8 text-center">

              <p className="text-sm text-gray-500">
                Belum ada aktivitas scan.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>

                  <tr className="border-b text-left">

                    <th className="pb-3 font-medium text-gray-500">
                      QR
                    </th>

                    <th className="pb-3 font-medium text-gray-500">
                      Waktu
                    </th>

                    <th className="pb-3 font-medium text-gray-500">
                      Perangkat
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {scanRows
                    .slice(0, 10)
                    .map((scan) => {

                      const qr = qrList.find(
                        (item) =>
                          item.id ===
                          scan.qr_card_id
                      );

                      return (
                        <tr
                          key={scan.id}
                          className="border-b last:border-0"
                        >

                          <td className="py-4 font-medium text-gray-900">
                            {qr?.code ?? "-"}
                          </td>

                          <td className="py-4 text-gray-600">
                            {new Date(
                              scan.scanned_at
                            ).toLocaleString(
                              "id-ID",
                              {
                                dateStyle:
                                  "medium",
                                timeStyle:
                                  "short",
                              }
                            )}
                          </td>

                          <td className="max-w-sm truncate py-4 text-gray-500">
                            {scan.user_agent ??
                              "Tidak diketahui"}
                          </td>

                        </tr>
                      );
                    })}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </main>
  );
}

// =========================
// STAT CARD
// =========================

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {description}
      </p>

    </div>
  );
}