import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import QRPreview from "./QRCodePreview";

function isValidUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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

export default async function QRDetailPage({
  params,
}: Props) {
  await connection();

  const { id } = await params;

  if (!isValidUUID(id)) {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            QR tidak ditemukan
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            ID QR yang diberikan tidak valid.
          </p>

          <Link
            href="/protected/qr-codes"
            className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Kembali ke QR Code
          </Link>
        </div>
      </div>
    </main>
  );
}

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

  // =========================
  // QR CARD
  // =========================

  const { data: qrCard, error: qrError } =
    await supabase
      .from("qr_cards")
      .select(
        "id, serial_number, code, status, business_id, created_at, activated_at"
      )
      .eq("id", id)
      .maybeSingle();

  if (qrError) {
    console.error(
      "QR detail error:",
      qrError
    );
  }

  if (!qrCard) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl bg-white p-8 shadow-sm">

            <h1 className="text-xl font-bold text-gray-900">
              QR tidak ditemukan
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              QR tersebut tidak ditemukan.
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
  // BUSINESS
  // =========================

  let business:
    | {
        id: string;
        name: string;
        organization_id: string;
      }
    | null = null;

  if (qrCard.business_id) {
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, name, organization_id"
      )
      .eq("id", qrCard.business_id)
      .eq(
        "organization_id",
        membership.organization_id
      )
      .maybeSingle();

    if (error) {
      console.error(
        "QR business error:",
        error
      );
    }

    business = data;
  }

  // =========================
  // SECURITY CHECK
  // =========================

  if (
    qrCard.business_id &&
    !business
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl bg-white p-8 shadow-sm">

            <h1 className="text-xl font-bold text-gray-900">
              QR tidak dapat diakses
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              QR ini tidak terhubung dengan bisnis
              dalam organisasi Anda.
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
  // SCANS
  // =========================

  let scanRows: ScanRow[] = [];

  const { data: scans, error: scanError } =
    await supabase
      .from("qr_scan_events")
      .select(
        "id, qr_card_id, business_id, scanned_at, user_agent"
      )
      .eq("qr_card_id", qrCard.id)
      .order("scanned_at", {
        ascending: false,
      });

  if (scanError) {
    console.error(
      "QR scan error:",
      scanError
    );
  } else {
    scanRows = scans ?? [];
  }

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

  // =========================
  // PUBLIC URL
  // =========================

  const publicUrl = `/q/${qrCard.code}`;

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      <div className="mx-auto max-w-7xl">

        {/* =========================
            HEADER
        ========================= */}

        <div className="mb-8">

          <Link
            href={
              business
                ? `/protected/businesses/${business.id}`
                : "/protected/businesses"
            }
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Kembali
          </Link>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>

              <div className="flex items-center gap-3">

                <h1 className="text-3xl font-bold text-gray-900">
                  {qrCard.code}
                </h1>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    qrCard.status === "active"
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {qrCard.status === "active"
                    ? "Aktif"
                    : qrCard.status}
                </span>

              </div>

              <p className="mt-2 text-sm text-gray-500">
                Detail dan aktivitas QR Code.
              </p>

            </div>

            {business && (
              <Link
                href={`/protected/businesses/${business.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {business.name}
              </Link>
            )}

          </div>

        </div>

        {/* =========================
            TOP CONTENT
        ========================= */}

        <div className="grid gap-6 lg:grid-cols-2">

          {/* QR DISPLAY */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <div className="mb-5">

              <h2 className="text-lg font-semibold text-gray-900">
                QR Code
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Scan QR ini untuk membuka Google Review.
              </p>

            </div>

            <QRPreview
              name={qrCard.code}
              code={qrCard.code}
              businessName={
                business?.name ?? "-"
              }
              isActive={
                qrCard.status === "active"
              }
            />

          </div>

          {/* QR INFORMATION */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold text-gray-900">
              Informasi QR
            </h2>

            <div className="mt-5 space-y-5">

              <div>
                <p className="text-xs text-gray-500">
                  Kode
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {qrCard.code}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Serial Number
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {qrCard.serial_number}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Bisnis
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {business?.name ?? "Belum terhubung"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  URL QR
                </p>

                <p className="mt-1 break-all text-sm text-gray-600">
                  {publicUrl}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Diaktifkan
                </p>

                <p className="mt-1 text-sm text-gray-700">
                  {qrCard.activated_at
                    ? new Date(
                        qrCard.activated_at
                      ).toLocaleString(
                        "id-ID",
                        {
                          dateStyle:
                            "medium",
                          timeStyle:
                            "short",
                        }
                      )
                    : "-"}
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* =========================
            STATS
        ========================= */}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

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
            RECENT SCANS
        ========================= */}

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-5">

            <h2 className="text-lg font-semibold text-gray-900">
              Aktivitas Scan
            </h2>

            <p className="text-sm text-gray-500">
              10 scan terakhir untuk QR ini.
            </p>

          </div>

          {scanRows.length === 0 ? (

            <div className="rounded-xl border border-dashed p-8 text-center">

              <p className="text-sm text-gray-500">
                Belum ada scan untuk QR ini.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>

                  <tr className="border-b text-left">

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
                    .map((scan) => (

                      <tr
                        key={scan.id}
                        className="border-b last:border-0"
                      >

                        <td className="py-4 text-gray-700">
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

                        <td className="max-w-xl truncate py-4 text-gray-500">
                          {scan.user_agent ??
                            "Tidak diketahui"}
                        </td>

                      </tr>

                    ))}

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