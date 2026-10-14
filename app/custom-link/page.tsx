
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

import CustomLinkManager from "./CustomLinkManager";

const OWNER_USER_ID =
  "6254768d-5805-41e3-8f03-b168081f9102";

const OWNER_ORGANIZATION_ID =
  "2a3a6d01-73ac-4656-b8e7-2c4208593362";

export default async function CustomLinkPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  let organizationId: string;
  let resellerUserId: string | null = null;

  if (user.id === OWNER_USER_ID) {
    organizationId = OWNER_ORGANIZATION_ID;
  } else {
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "reseller")
      .limit(2);

    if (error || !memberships || memberships.length !== 1) {
      return (
        <main className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">
              Custom Link
            </h1>
            <p className="mt-3 text-red-600">
              Akun tidak memiliki akses yang valid ke halaman ini.
              Hubungi Owner untuk memeriksa membership.
            </p>
            <Link
              href="/protected"
              className="mt-5 inline-block text-blue-600 hover:underline"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </main>
      );
    }

    organizationId = memberships[0].organization_id;
    resellerUserId = user.id;
  }

  let query = supabase
    .from("qr_cards")
    .select(
      "id, serial_number, code, status, custom_link_url, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("destination_type", "custom_link")
    .order("created_at", { ascending: false });

  if (resellerUserId) {
    query = query.eq("reseller_user_id", resellerUserId);
  }

  const { data: qrCards, error } = await query;

  if (error) {
    console.error("Custom Link list error:", error);
  }

  const cards = (qrCards ?? []).map((qr) => ({
    ...qr,
    custom_link_url: qr.custom_link_url ?? null,
  }));

  const activeCount = cards.filter(
    (qr) => qr.status === "active" && qr.custom_link_url
  ).length;

  const emptyCount = cards.filter(
    (qr) => qr.status === "empty"
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/protected"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← Kembali ke Dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Custom Link
          </h1>

          <p className="mt-2 text-gray-500">
            Buat QR yang mengarahkan pengunjung ke URL pilihan Anda.
          </p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard title="Total QR" value={cards.length} />
          <StatCard title="QR Aktif" value={activeCount} />
          <StatCard title="Belum Aktif" value={emptyCount} />
        </div>

        <CustomLinkManager cards={cards} />

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Daftar QR gagal dimuat. Periksa kebijakan akses database.
          </p>
        )}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
