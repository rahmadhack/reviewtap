import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import ResellerInviteButton from "./ResellerInviteButton";

export default async function ResellerInvitesPage() {
  await connection();

  const supabase = await createClient();

  // =========================================================
  // 1. CEK LOGIN
  // =========================================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // =========================================================
  // 2. CEK ROLE
  // =========================================================

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (
    membershipError ||
    !membership
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900">
              Akses Ditolak
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Hanya owner atau admin yang dapat
              membuat invite reseller.
            </p>

            <Link
              href="/protected"
              className="mt-6 inline-block text-sm font-medium text-blue-600"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================
  // 3. HALAMAN INVITE
  // =========================================================

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <Link
            href="/protected"
            className="text-sm font-medium text-blue-600"
          >
            ← Kembali ke Dashboard
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Invite Reseller
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Buat link khusus untuk mendaftarkan
            reseller ReviewTap baru.
          </p>

          <div className="mt-6 rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              Invite berlaku selama 72 jam dan hanya
              dapat digunakan satu kali.
            </p>
          </div>

          <div className="mt-6">
            <ResellerInviteButton />
          </div>
        </div>
      </div>
    </main>
  );
}