
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ResellersPage() {
  await connection();

  const supabase = await createClient();

  // 1. Pastikan pengguna sudah login.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Pastikan pengguna adalah owner atau admin organisasi.
  const { data: membership, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

  if (membershipError || !membership) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Akses Ditolak
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Hanya owner atau admin organisasi yang dapat
            melihat daftar reseller.
          </p>
          <Link
            href="/protected"
            className="mt-6 inline-block text-sm font-medium text-blue-600"
          >
            ← Kembali ke Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 3. Ambil reseller yang sudah menjadi anggota organisasi.
  const { data: resellerMembers, error: resellerError } =
    await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", membership.organization_id)
      .eq("role", "reseller");

  if (resellerError) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Daftar Reseller belum dapat dimuat
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Terjadi kesalahan saat mengambil data keanggotaan.
            Silakan coba lagi.
          </p>
          <Link
            href="/protected"
            className="mt-6 inline-block text-sm font-medium text-blue-600"
          >
            ← Kembali ke Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // 4. Ambil nama dan email dari akun Supabase Auth.
  // Service role hanya digunakan di server, setelah pemeriksaan akses.
  const admin = createAdminClient();

  const resellers = await Promise.all(
    (resellerMembers ?? []).map(async (member) => {
      const { data, error } = await admin.auth.admin.getUserById(
        member.user_id,
      );

      const resellerUser = error ? null : data.user;

      return {
        id: member.user_id,
        name:
          resellerUser?.user_metadata?.full_name ||
          resellerUser?.user_metadata?.name ||
          "Nama belum diisi",
        email: resellerUser?.email || "Email tidak tersedia",
        joinedAt: resellerUser?.created_at || null,
      };
    }),
  );

  resellers.sort((a, b) => {
    if (!a.joinedAt) return 1;
    if (!b.joinedAt) return -1;
    return b.joinedAt.localeCompare(a.joinedAt);
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/protected"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            ← Kembali ke Dashboard
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Daftar Reseller
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Daftar akun reseller yang sudah bergabung dengan
              organisasi ini.
            </p>
          </div>

          <Link
            href="/protected/reseller-invites"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Invite Reseller
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Reseller
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {resellers.length}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Semua Reseller
            </h2>
          </div>

          {resellers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="font-medium text-gray-900">
                Belum ada reseller
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Reseller akan muncul otomatis setelah berhasil
                mendaftar melalui link invite organisasi ini.
              </p>
              <Link
                href="/protected/reseller-invites"
                className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Buat Invite Reseller
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nama</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">
                      Tanggal Daftar
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resellers.map((reseller) => (
                    <tr key={reseller.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">
                        {reseller.name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {reseller.email}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {reseller.joinedAt
                          ? new Date(
                              reseller.joinedAt,
                            ).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
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
