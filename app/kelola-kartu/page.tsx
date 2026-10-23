import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import QRCardSearch from "./QRCardSearch";
import AddEmptyQRButton from "./AddEmptyQRButton";

const OWNER_USER_ID = "6254768d-5805-41e3-8f03-b168081f9102";
const OWNER_ORGANIZATION_ID = "2a3a6d01-73ac-4656-b8e7-2c4208593362";

type QRCardRow = {
  id: string;
  serial_number: string;
  code: string;
  status: string;
  business_id: string | null;
  google_place_id: string | null;
  created_at: string;
};

export default async function KelolaKartuPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const isOwner = user.id === OWNER_USER_ID;

  let organizationId: string;
  let resellerUserId: string | null = null;

  if (isOwner) {
    // QR baru milik Owner menggunakan organisasi ReviewTap Indonesia.
    organizationId = OWNER_ORGANIZATION_ID;
  } else {
    // Reseller harus memiliki tepat satu membership reseller.
    const { data: memberships, error: membershipError } =
      await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "reseller")
        .limit(2);

    if (membershipError) {
      console.error("Membership error:", membershipError);

      return (
        <main className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Gagal memverifikasi akun reseller
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Silakan muat ulang halaman atau hubungi administrator.
            </p>
          </div>
        </main>
      );
    }

    if (!memberships || memberships.length !== 1) {
      return (
        <main className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              Akses inventaris belum dapat ditentukan
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Akun harus memiliki tepat satu keanggotaan reseller.
              Hubungi administrator untuk memeriksa keanggotaan akun Anda.
            </p>
          </div>
        </main>
      );
    }

    organizationId = memberships[0].organization_id;
    resellerUserId = user.id;
  }

  // Ambil bisnis hanya dari organisasi yang telah diverifikasi.
  const {
    data: businesses,
    error: businessesError,
  } = await supabase
    .from("businesses")
    .select("id, name, google_review_url")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (businessesError) {
    console.error("Businesses error:", businessesError);

    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-red-600">
            Gagal mengambil data bisnis
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Data bisnis tidak dapat dimuat. Silakan coba lagi.
          </p>
        </div>
      </main>
    );
  }

  const businessList = businesses ?? [];

  // Batasi query QR langsung ke inventaris pengguna yang berwenang.
  let qrCards: QRCardRow[] = [];

  if (isOwner) {
    // Owner melihat seluruh QR pada organisasi Owner.
    const { data, error } = await supabase
      .from("qr_cards")
      .select(
        "id, serial_number, code, status, business_id, google_place_id, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Owner QR cards error:", error);
    } else {
      qrCards = (data ?? []) as QRCardRow[];
    }
  } else {
    // Reseller hanya melihat QR yang secara eksplisit dimiliki akunnya.
    const { data, error } = await supabase
      .from("qr_cards")
      .select(
        "id, serial_number, code, status, business_id, google_place_id, created_at"
      )
      .eq("reseller_user_id", resellerUserId!)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Reseller QR cards error:", error);
    } else {
      qrCards = (data ?? []) as QRCardRow[];
    }
  }

  const totalQR = qrCards.length;

  const activeQR = qrCards.filter(
    (qr) => qr.status === "active"
  ).length;

  const emptyQR = qrCards.filter(
    (qr) => qr.status === "empty" && !qr.business_id
  ).length;

  // Siapkan data kartu untuk komponen pencarian di browser.
  const searchableCards = qrCards.map((qr) => {
    const business = businessList.find(
      (item) => item.id === qr.business_id
    );

    return {
      id: qr.id,
      serialNumber: qr.serial_number,
      code: qr.code,
      status: qr.status,
      businessName: business?.name ?? null,
      googlePlaceId: qr.google_place_id,
    };
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Kelola Kartu
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Kelola QR Card ReviewTap Anda. QR kosong dapat dicetak
              terlebih dahulu dan dikonfigurasi saat pertama kali discan.
            </p>
          </div>

          <AddEmptyQRButton />
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Total QR</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalQR}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              QR dalam inventaris yang dapat Anda kelola
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">QR Aktif</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {activeQR}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Sudah terhubung bisnis
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">QR Kosong</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {emptyQR}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Siap dicetak
            </p>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Kartu QR
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Cari berdasarkan Kode Kartu atau nomor seri, lalu buka
              detail kartu untuk mengelolanya.
            </p>
          </div>

          {qrCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <h3 className="font-semibold text-gray-900">
                Belum ada QR Card
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Belum ada QR Card dalam inventaris akun Anda.
              </p>
            </div>
          ) : (
            <QRCardSearch cards={searchableCards} />
          )}
        </section>
      </div>
    </main>
  );
}