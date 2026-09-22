import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import QRCard from "./QRCard";

export default async function KelolaKartuPage() {
  const supabase = await createClient();

  // =========================================================
  // 1. CEK USER
  // =========================================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // =========================================================
  // 2. CARI ORGANIZATION USER
  // =========================================================

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error(
      "Membership error:",
      membershipError
    );

    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Gagal mengambil data organisasi
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {membershipError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              Organization belum ditemukan
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Akun Anda belum terhubung dengan organisasi.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const organizationId =
    membership.organization_id;

  // =========================================================
  // 3. AMBIL BISNIS MILIK ORGANIZATION
  // =========================================================

  const {
    data: businesses,
    error: businessesError,
  } = await supabase
    .from("businesses")
    .select(
      `
        id,
        name,
        google_review_url
      `
    )
    .eq(
      "organization_id",
      organizationId
    )
    .order("created_at", {
      ascending: false,
    });

  if (businessesError) {
    console.error(
      "Businesses error:",
      businessesError
    );

    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Gagal mengambil data bisnis
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {businessesError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const businessList = businesses ?? [];

  const businessIds = businessList.map(
    (business) => business.id
  );

  // =========================================================
  // 4. AMBIL QR
  //
  // Kita hanya mengambil QR yang:
  //
  // - business_id null
  // - ATAU business_id milik organization
  //
  // Dengan demikian QR kosong tetap bisa ditampilkan.
  // =========================================================

  let qrCards: {
    id: string;
    serial_number: string;
    code: string;
    status: string;
    business_id: string | null;
    google_place_id: string | null;
    created_at: string;
  }[] = [];

  const { data: allQRCards, error: qrError } =
    await supabase
      .from("qr_cards")
      .select(
        `
          id,
          serial_number,
          code,
          status,
          business_id,
          google_place_id,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

  if (qrError) {
    console.error(
      "QR cards error:",
      qrError
    );
  } else {
    qrCards =
      allQRCards?.filter((qr) => {
        // QR kosong
        if (!qr.business_id) {
          return true;
        }

        // QR aktif milik bisnis organization
        return businessIds.includes(
          qr.business_id
        );
      }) ?? [];
  }

  // =========================================================
  // 5. HITUNG STATISTIK
  // =========================================================

  const totalQR = qrCards.length;

  const activeQR = qrCards.filter(
    (qr) => qr.status === "active"
  ).length;

  const emptyQR = qrCards.filter(
    (qr) =>
      qr.status === "empty" &&
      !qr.business_id
  ).length;

  // =========================================================
  // 6. RENDER
  // =========================================================

  return (
    <main className="min-h-screen bg-gray-50">

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <Link
              href="/protected"
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              ← Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Kelola Kartu
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Kelola QR Card ReviewTap Anda.
              QR kosong dapat dicetak terlebih dahulu
              dan dikonfigurasi saat pertama kali discan.
            </p>
          </div>

        </div>

        {/* ================================================= */}
        {/* STATISTICS */}
        {/* ================================================= */}

        <div className="mt-8 grid gap-5 sm:grid-cols-3">

          {/* TOTAL */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-gray-500">
              Total QR
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalQR}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Semua QR Card
            </p>

          </div>

          {/* ACTIVE */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-gray-500">
              QR Aktif
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeQR}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Sudah terhubung bisnis
            </p>

          </div>

          {/* EMPTY */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-gray-500">
              QR Kosong
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {emptyQR}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Siap dicetak
            </p>

          </div>

        </div>

        {/* ================================================= */}
        {/* QR CARDS */}
        {/* ================================================= */}

        <section className="mt-10">

          <div className="mb-5">

            <h2 className="text-xl font-bold text-gray-900">
              Kartu QR
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Semua QR Card yang tersedia untuk organisasi Anda.
            </p>

          </div>

          {qrCards.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">

              <h3 className="font-semibold text-gray-900">
                Belum ada QR Card
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Belum ada QR Card yang tersedia.
              </p>

            </div>

          ) : (

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

              {qrCards.map((qr) => {

                const business =
                  businessList.find(
                    (item) =>
                      item.id ===
                      qr.business_id
                  );

                return (
                  <QRCard
                    key={qr.id}
                    id={qr.id}
                    serialNumber={
                      qr.serial_number
                    }
                    code={qr.code}
                    status={qr.status}
                    businessName={
                      business?.name ??
                      null
                    }
                    googlePlaceId={
                      qr.google_place_id
                    }
                  />
                );
              })}

            </div>

          )}

        </section>

      </div>

    </main>
  );
}