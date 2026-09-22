import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessesPage() {
  await connection();

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

  const { data: membership, error: membershipError } = await supabase
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
  // BUSINESSES
  // =========================

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select(
      "id, name, google_review_url, created_at"
    )
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (businessesError) {
    console.error("Businesses page error:", businessesError);
  }

  const businessList = businesses ?? [];

  // =========================
  // QR CARDS
  // =========================

  const businessIds = businessList.map(
    (business) => business.id
  );

  let qrCards: {
    id: string;
    business_id: string | null;
    code: string;
    serial_number: string;
    status: string;
  }[] = [];

  if (businessIds.length > 0) {
    const { data, error } = await supabase
      .from("qr_cards")
      .select(
        "id, business_id, code, serial_number, status"
      )
      .in("business_id", businessIds);

    if (error) {
      console.error("Businesses QR error:", error);
    } else {
      qrCards = data ?? [];
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* =========================
            HEADER
        ========================= */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Bisnis
            </h1>

            <p className="mt-2 text-gray-500">
              Kelola bisnis dan QR ReviewTap Anda.
            </p>
          </div>

          <Link
            href="/protected/businesses/new"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Tambah Bisnis
          </Link>

        </div>

        {/* =========================
            BUSINESS LIST
        ========================= */}

        {businessList.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <h2 className="text-lg font-semibold text-gray-900">
              Belum ada bisnis
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Tambahkan bisnis pertama Anda untuk mulai menggunakan
              ReviewTap.
            </p>

            <Link
              href="/protected/businesses/new"
              className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Tambah Bisnis
            </Link>

          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">

            {businessList.map((business) => {

              const businessQRs = qrCards.filter(
                (qr) => qr.business_id === business.id
              );

              const activeQRs = businessQRs.filter(
                (qr) => qr.status === "active"
              );

              return (
                <div
                  key={business.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >

                  {/* BUSINESS NAME */}

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {business.name}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Bisnis ReviewTap
                      </p>
                    </div>

                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                      {activeQRs.length} QR aktif
                    </span>

                  </div>

                  {/* INFO */}

                  <div className="mt-6 space-y-3">

                    <div className="rounded-xl bg-gray-50 p-4">

                      <p className="text-xs text-gray-500">
                        Google Review
                      </p>

                      <p className="mt-1 truncate text-sm text-gray-700">
                        {business.google_review_url || "-"}
                      </p>

                    </div>

                    <div className="grid grid-cols-2 gap-3">

                      <div className="rounded-xl border p-4">

                        <p className="text-xs text-gray-500">
                          Total QR
                        </p>

                        <p className="mt-1 text-xl font-bold text-gray-900">
                          {businessQRs.length}
                        </p>

                      </div>

                      <div className="rounded-xl border p-4">

                        <p className="text-xs text-gray-500">
                          QR Aktif
                        </p>

                        <p className="mt-1 text-xl font-bold text-gray-900">
                          {activeQRs.length}
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="mt-6 flex flex-wrap gap-3">

                    <Link
                      href={`/protected/businesses/${business.id}`}
                      className="inline-flex flex-1 items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      Detail
                    </Link>

                    <Link
                      href={`/protected/businesses/${business.id}/edit`}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>
    </main>
  );
}