import { connection } from "next/server";
import { redirect, notFound } from "next/navigation";
import { createClient } from "../../../../utils/supabase/server";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;

  const supabase = await createClient();

  // 1. Cek user login
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
   redirect("/auth/login");
  }

  // 2. Cari organization user
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    redirect("/protected/businesses");
  }

  // 3. Ambil bisnis
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // 4. Tampilkan halaman
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <a
          href="/protected/businesses"
          className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Kembali ke Bisnis
        </a>
        <a
          href={`/protected/businesses/${id}/edit`}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          Edit Bisnis
        </a>

        <div className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">
            {business.name}
          </h1>

          <p className="mt-2 text-gray-600">
            Kelola bisnis, QR Code, NFC, dan Google Review Anda.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Nama Bisnis</p>
              <p className="mt-1 font-semibold text-gray-900">
                {business.name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Alamat</p>
              <p className="mt-1 font-semibold text-gray-900">
                {business.address || "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Nomor Telepon</p>
              <p className="mt-1 font-semibold text-gray-900">
                {business.phone || "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Google Review</p>

              {business.google_review_url ? (
                <a
                  href={business.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-blue-600 hover:underline"
                >
                  Buka Google Review
                </a>
              ) : (
                <p className="mt-1 text-gray-500">
                  Belum diatur
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}