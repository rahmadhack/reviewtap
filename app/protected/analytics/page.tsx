import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import DeviceStats from "./DeviceStats";

type Business = {
  id: string;
  name: string;
};

type QRCard = {
  id: string;
  code: string;
  serial_number: string;
  business_id: string | null;
};

type ScanRow = {
  id: string;
  qr_card_id: string;
  business_id: string;
  scanned_at: string;
  user_agent: string | null;
};

type QRStat = {
  id: string;
  code: string;
  serial_number: string;
  businessName: string;
  scans: number;
};

type BusinessStat = {
  id: string;
  name: string;
  scans: number;
};

type DailyStat = {
  date: string;
  label: string;
  count: number;
};

export default async function AnalyticsPage() {
  await connection();

  const supabase = await createClient();

  // =========================================================
  // AUTH
  // =========================================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // =========================================================
  // ORGANIZATION
  // =========================================================

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">
              Analytics
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Organisasi belum ditemukan.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================
  // BUSINESSES
  // =========================================================

  const {
    data: businesses,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .order("name", { ascending: true });

  if (businessError) {
    console.error("Analytics business error:", businessError);
  }

  const businessList: Business[] = businesses ?? [];

  const businessIds = businessList.map(
    (business) => business.id
  );

  // =========================================================
  // QR CARDS
  // =========================================================

  let qrCards: QRCard[] = [];

  if (businessIds.length > 0) {
    const {
      data: qrData,
      error: qrError,
    } = await supabase
      .from("qr_cards")
      .select(
        "id, code, serial_number, business_id"
      )
      .in("business_id", businessIds)
      .order("created_at", {
        ascending: false,
      });

    if (qrError) {
      console.error(
        "Analytics QR error:",
        qrError
      );
    }

    qrCards = qrData ?? [];
  }

  // =========================================================
  // SCAN EVENTS
  // =========================================================

  let scanRows: ScanRow[] = [];

  if (businessIds.length > 0) {
    const {
      data: scans,
      error: scanError,
    } = await supabase
      .from("qr_scan_events")
      .select(
        "id, qr_card_id, business_id, scanned_at, user_agent"
      )
      .in("business_id", businessIds)
      .order("scanned_at", {
        ascending: false,
      });

    if (scanError) {
      console.error(
        "Analytics scan error:",
        scanError
      );
    } else {
      scanRows = scans ?? [];
    }
  }

  // =========================================================
  // DATE RANGE
  // =========================================================

  const now = new Date();

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const start7Days = new Date(now);
  start7Days.setDate(
    start7Days.getDate() - 7
  );
  start7Days.setHours(0, 0, 0, 0);

  const start30Days = new Date(now);
  start30Days.setDate(
    start30Days.getDate() - 30
  );
  start30Days.setHours(0, 0, 0, 0);

  // =========================================================
  // SUMMARY
  // =========================================================

  const totalScans = scanRows.length;

  const scansToday = scanRows.filter(
    (scan) =>
      new Date(scan.scanned_at) >= startToday
  ).length;

  const scans7Days = scanRows.filter(
    (scan) =>
      new Date(scan.scanned_at) >= start7Days
  ).length;

  const scans30Days = scanRows.filter(
    (scan) =>
      new Date(scan.scanned_at) >= start30Days
  ).length;

  // =========================================================
  // DAILY STATS - 30 DAYS
  // =========================================================

  const dailyStats: DailyStat[] = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);

    date.setDate(
      date.getDate() - i
    );

    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);

    nextDate.setDate(
      nextDate.getDate() + 1
    );

    const count = scanRows.filter(
      (scan) => {
        const scannedAt = new Date(
          scan.scanned_at
        );

        return (
          scannedAt >= date &&
          scannedAt < nextDate
        );
      }
    ).length;

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    dailyStats.push({
      date: `${year}-${month}-${day}`,
      label: `${day} ${date.toLocaleDateString(
        "id-ID",
        {
          month: "short",
        }
      )}`,
      count,
    });
  }

  const maxDailyScan = Math.max(
    ...dailyStats.map(
      (item) => item.count
    ),
    1
  );

  // =========================================================
  // SCAN BERDASARKAN QR
  // =========================================================

  const qrStats: QRStat[] = qrCards
    .map((qr) => {
      const scans = scanRows.filter(
        (scan) =>
          scan.qr_card_id === qr.id
      ).length;

      const business =
        businessList.find(
          (item) =>
            item.id === qr.business_id
        );

      return {
        id: qr.id,
        code: qr.code,
        serial_number:
          qr.serial_number,
        businessName:
          business?.name ??
          "Bisnis tidak ditemukan",
        scans,
      };
    })
    .sort(
      (a, b) => b.scans - a.scans
    );

  // =========================================================
  // SCAN BERDASARKAN BISNIS
  // =========================================================

  const businessStats: BusinessStat[] =
    businessList
      .map((business) => {
        const scans =
          scanRows.filter(
            (scan) =>
              scan.business_id ===
              business.id
          ).length;

        return {
          id: business.id,
          name: business.name,
          scans,
        };
      })
      .sort(
        (a, b) => b.scans - a.scans
      );

  // =========================================================
  // AKTIVITAS TERBARU
  // =========================================================

  const recentScans = scanRows.slice(
    0,
    10
  );

  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatDate(
    value: string
  ) {
    return new Date(
      value
    ).toLocaleString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function getBusinessName(
    businessId: string
  ) {
    return (
      businessList.find(
        (business) =>
          business.id === businessId
      )?.name ??
      "Bisnis tidak ditemukan"
    );
  }

  function getQRCode(
    qrCardId: string
  ) {
    return (
      qrCards.find(
        (qr) => qr.id === qrCardId
      )?.code ??
      "-"
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-8">
          <div className="mb-2">
            <Link
              href="/protected"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← Dashboard
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            Analytics
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Pantau aktivitas scan QR bisnis Anda.
          </p>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <div className="grid gap-4 md:grid-cols-3">

          <StatCard
            title="Scan Hari Ini"
            value={scansToday}
            description="Scan sejak pukul 00:00"
          />

          <StatCard
            title="7 Hari Terakhir"
            value={scans7Days}
            description="Aktivitas scan 7 hari"
          />

          <StatCard
            title="30 Hari Terakhir"
            value={scans30Days}
            description="Aktivitas scan 30 hari"
          />

        </div>

        {/* =====================================================
            GRAFIK 30 HARI
        ===================================================== */}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Scan 30 Hari Terakhir
            </h2>

            <p className="text-sm text-gray-500">
              Jumlah scan QR setiap hari.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div
              className="flex min-w-[900px] items-end gap-2"
              style={{
                height: "280px",
              }}
            >
              {dailyStats.map(
                (item) => {
                  const height =
                    item.count === 0
                      ? 4
                      : Math.max(
                          12,
                          (item.count /
                            maxDailyScan) *
                            220
                        );

                  return (
                    <div
                      key={item.date}
                      className="flex h-full min-w-[22px] flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-1 text-[9px] text-gray-500">
                        {item.count}
                      </span>

                      <div
                        className="w-full rounded-t-md bg-blue-600"
                        style={{
                          height: `${height}px`,
                        }}
                      />

                      <span className="mt-2 whitespace-nowrap text-[8px] text-gray-400">
                        {item.label}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

        </section>

        {/* =====================================================
            SCAN BERDASARKAN QR
        ===================================================== */}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Scan Berdasarkan QR
            </h2>

            <p className="text-sm text-gray-500">
              QR yang paling sering digunakan.
            </p>
          </div>

          {qrStats.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-gray-500">
                Belum ada QR Code.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-xs font-medium text-gray-500">
                      QR
                    </th>

                    <th className="pb-3 text-xs font-medium text-gray-500">
                      Bisnis
                    </th>

                    <th className="pb-3 text-right text-xs font-medium text-gray-500">
                      Total Scan
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {qrStats.map(
                    (qr) => (
                      <tr
                        key={qr.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4">
                          <Link
                            href={`/protected/qr-codes/${qr.id}`}
                            className="font-medium text-blue-600 hover:text-blue-700"
                          >
                            {qr.code}
                          </Link>

                          <p className="mt-1 text-xs text-gray-400">
                            {qr.serial_number}
                          </p>
                        </td>

                        <td className="py-4 text-sm text-gray-700">
                          {qr.businessName}
                        </td>

                        <td className="py-4 text-right">
                          <span className="font-semibold text-gray-900">
                            {qr.scans}
                          </span>

                          <span className="ml-1 text-xs text-gray-400">
                            scan
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

        </section>

        {/* =====================================================
            SCAN BERDASARKAN BISNIS
        ===================================================== */}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Scan Berdasarkan Bisnis
            </h2>

            <p className="text-sm text-gray-500">
              Total scan untuk setiap bisnis.
            </p>
          </div>

          {businessStats.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-gray-500">
                Belum ada data bisnis.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {businessStats.map(
                (business) => (
                  <div
                    key={business.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {business.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Aktivitas QR
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {business.scans}
                      </p>

                      <p className="text-xs text-gray-400">
                        scan
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        </section>

        {/* =====================================================
            PERANGKAT & BROWSER
            PENTING:
            Component ini berada DI LUAR card bisnis.
        ===================================================== */}

        <DeviceStats scans={scanRows} />

        {/* =====================================================
            AKTIVITAS TERBARU
        ===================================================== */}

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Aktivitas Terbaru
            </h2>

            <p className="text-sm text-gray-500">
              10 aktivitas scan terakhir.
            </p>
          </div>

          {recentScans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-gray-500">
                Belum ada aktivitas scan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-xs font-medium text-gray-500">
                      Bisnis
                    </th>

                    <th className="pb-3 text-xs font-medium text-gray-500">
                      QR
                    </th>

                    <th className="pb-3 text-xs font-medium text-gray-500">
                      Waktu
                    </th>

                    <th className="pb-3 text-xs font-medium text-gray-500">
                      Perangkat
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentScans.map(
                    (scan) => (
                      <tr
                        key={scan.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 text-sm font-medium text-gray-900">
                          {getBusinessName(
                            scan.business_id
                          )}
                        </td>

                        <td className="py-4 text-sm text-gray-700">
                          {getQRCode(
                            scan.qr_card_id
                          )}
                        </td>

                        <td className="py-4 text-sm text-gray-600">
                          {formatDate(
                            scan.scanned_at
                          )}
                        </td>

                        <td className="max-w-[350px] py-4">
                          <p className="truncate text-xs text-gray-500">
                            {scan.user_agent ??
                              "Tidak diketahui"}
                          </p>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

        </section>

      </div>
    </main>
  );
}

// =============================================================
// STAT CARD
// =============================================================

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
      <p className="text-xs font-medium text-gray-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {description}
      </p>
    </div>
  );
}