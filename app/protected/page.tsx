import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export default async function ProtectedPage() {
  await connection();

  const supabase = await createClient();

  // 1. Pastikan pengguna sudah login
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Ambil organisasi pengguna
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
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-red-600">
              Organization belum ditemukan.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const organizationId = membership.organization_id;

  // 3. Ambil bisnis dalam organisasi
  const { data: businesses, error: businessesError } =
    await supabase
      .from("businesses")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

  if (businessesError) {
    console.error(
      "Dashboard businesses error:",
      businessesError
    );
  }

  const businessList = businesses ?? [];
  const businessIds = businessList.map((business) => business.id);

  // 4. Ambil QR Card
  let qrCards: {
    id: string;
    serial_number: string;
    code: string;
    status: string;
    business_id: string | null;
    created_at: string;
  }[] = [];

  if (businessIds.length > 0) {
    const { data, error } = await supabase
      .from("qr_cards")
      .select(
        "id, serial_number, code, status, business_id, created_at"
      )
      .in("business_id", businessIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Dashboard QR error:", error);
    }

    qrCards = data ?? [];
  }

  // 5. Statistik QR
  const totalQR = qrCards.length;

  const activeQR = qrCards.filter(
    (qr) => qr.status === "active"
  ).length;

  // 6. Ambil scan terbaru dan total scan
  let totalScans = 0;

  let recentScans: {
    id: string;
    qr_card_id: string;
    business_id: string;
    scanned_at: string;
    user_agent: string | null;
  }[] = [];

  if (businessIds.length > 0) {
    const { data: scanRows, error: scanError } =
      await supabase
        .from("qr_scan_events")
        .select(
          "id, qr_card_id, business_id, scanned_at, user_agent"
        )
        .in("business_id", businessIds)
        .order("scanned_at", { ascending: false })
        .limit(5);

    if (scanError) {
      console.error("Dashboard scan error:", scanError);
    } else {
      recentScans = scanRows ?? [];
    }

    const { count, error: countError } = await supabase
      .from("qr_scan_events")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("business_id", businessIds);

    if (countError) {
      console.error(
        "Dashboard scan count error:",
        countError
      );
    } else {
      totalScans = count ?? 0;
    }
  }

  // 7. QR terbaru
  const latestQR = qrCards.slice(0, 5);

  // 8. Dashboard
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>

          <p className="mt-2 text-gray-500">
            Kelola ReviewTap Anda dari satu tempat.
          </p>
        </div>

        {/* Welcome */}
        <div className="mb-6 rounded-2xl bg-blue-600 p-6 text-white shadow">
          <p className="text-sm opacity-80">
            Selamat datang kembali
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            {user.email}
          </h2>

          <p className="mt-2 text-sm opacity-80">
            ReviewTap siap membantu meningkatkan review Google bisnis Anda.
          </p>
        </div>

        {/* Statistik */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Bisnis"
            value={businessList.length}
            description="Bisnis terdaftar"
          />

          <StatCard
            title="QR Aktif"
            value={activeQR}
            description="QR sudah terhubung"
          />

          <StatCard
            title="Total Scan"
            value={totalScans}
            description="Total scan QR"
          />

          <StatCard
            title="Total QR"
            value={totalQR}
            description="Semua QR Card"
          />
        </div>

        {/* Menu Utama - dipindahkan ke atas Scan Terbaru */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-gray-900">
            Menu Utama
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Kelola fitur ReviewTap Anda.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard
              title="Invite Reseller"
              description="Buat dan bagikan undangan untuk reseller baru."
              href="/protected/reseller-invites"
            />

            <DashboardCard
              title="Kartu Review"
              description="Kelola kartu review yang terhubung dengan QR."
              href="/kelola-kartu"
            />

            <DashboardCard
              title="Custom Link"
              description="Buat dan kelola QR yang mengarahkan pengunjung ke URL pilihan Anda."
              href="/custom-link"
            />

            <DashboardCard
              title="Analytics"
              description="Pantau aktivitas QR dan NFC."
              href="/protected/analytics"
            />

            <DashboardCard
              title="Daftar Reseller"
              description="Lihat reseller yang sudah bergabung melalui undangan."
              href="/protected/resellers"
            />
          </div>
        </section>

        {/* Scan Terbaru - hanya lima data */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Scan Terbaru
              </h2>

              <p className="text-sm text-gray-500">
                Lima aktivitas scan QR terakhir
              </p>
            </div>

            <Link
              href="/protected/scans"
              className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
           Lihat semua
          </Link>
          </div>

          {recentScans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-gray-500">
                Belum ada scan QR.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-gray-500">
                      Bisnis
                    </th>
                    <th className="pb-3 font-medium text-gray-500">
                      QR
                    </th>
                    <th className="pb-3 font-medium text-gray-500">
                      Waktu
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentScans.map((scan) => {
                    const business = businessList.find(
                      (item) => item.id === scan.business_id
                    );

                    const qr = qrCards.find(
                      (item) => item.id === scan.qr_card_id
                    );

                    return (
                      <tr
                        key={scan.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 font-medium text-gray-900">
                          {business?.name ??
                            "Bisnis tidak ditemukan"}
                        </td>

                        <td className="py-4 text-gray-600">
                          {qr?.code ?? "-"}
                        </td>

                        <td className="py-4 text-gray-600">
                          {new Date(
                            scan.scanned_at
                          ).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* QR Terbaru */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                QR Terbaru
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                QR Code yang terakhir terdaftar.
              </p>
            </div>

            <Link
              href="/protected/qr-codes"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Lihat semua
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            {latestQR.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Belum ada QR Code.
              </div>
            ) : (
              latestQR.map((qr) => {
                const business = businessList.find(
                  (item) => item.id === qr.business_id
                );

                return (
                  <div
                    key={qr.id}
                    className="flex items-center justify-between border-b border-gray-100 p-5 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {qr.serial_number}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {business?.name ?? "Bisnis"}
                      </p>
                    </div>

                    <span
                      className={
                        qr.status === "active"
                          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                      }
                    >
                      {qr.status === "active"
                        ? "Aktif"
                        : "Belum Aktif"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

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
      <p className="text-sm text-gray-500">{title}</p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {description}
      </p>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">
        {title}
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        {description}
      </p>

      <Link
        href={href}
        className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Buka
      </Link>
    </div>
  );
}