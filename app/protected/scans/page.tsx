
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

type ScanRow = {
  id: string;
  qr_card_id: string;
  business_id: string;
  scanned_at: string;
  user_agent: string | null;
};

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();

  const params = await searchParams;
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Riwayat Scan
          </h1>
          <p className="mt-3 text-red-600">
            Organisasi belum ditemukan.
          </p>
          <Link
            href="/protected"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("organization_id", membership.organization_id);

  if (businessesError) {
    console.error("Scans businesses error:", businessesError);
  }

  const businessList = businesses ?? [];
  const businessIds = businessList.map((business) => business.id);

  let scans: ScanRow[] = [];
  let totalScans = 0;
  let qrCards: {
    id: string;
    code: string;
    serial_number: string;
  }[] = [];

  if (businessIds.length > 0) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await supabase
      .from("qr_scan_events")
      .select(
        "id, qr_card_id, business_id, scanned_at, user_agent",
        { count: "exact" }
      )
      .in("business_id", businessIds)
      .order("scanned_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Scans query error:", error);
    } else {
      scans = data ?? [];
      totalScans = count ?? 0;
    }

    const { data: qrData, error: qrError } = await supabase
      .from("qr_cards")
      .select("id, code, serial_number")
      .in("business_id", businessIds);

    if (qrError) {
      console.error("Scans QR query error:", qrError);
    } else {
      qrCards = qrData ?? [];
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalScans / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // Jika nomor halaman melebihi halaman terakhir, arahkan ke halaman terakhir.
  if (page > totalPages) {
    redirect(
      currentPage === 1
        ? "/protected/scans"
        : `/protected/scans?page=${currentPage}`
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/protected"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Kembali ke Dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Riwayat Scan
          </h1>

          <p className="mt-2 text-gray-500">
            Semua aktivitas scan QR dari bisnis dalam organisasi Anda.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm text-gray-500">Total scan</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {totalScans.toLocaleString("id-ID")}
            </p>
          </div>

          {scans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-gray-500">
                Belum ada aktivitas scan QR.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="whitespace-nowrap pb-3 pr-4 font-medium text-gray-500">
                        Bisnis
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 font-medium text-gray-500">
                        QR
                      </th>
                      <th className="whitespace-nowrap pb-3 pr-4 font-medium text-gray-500">
                        Waktu Scan
                      </th>
                      <th className="whitespace-nowrap pb-3 font-medium text-gray-500">
                        Perangkat
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {scans.map((scan) => {
                      const business = businessList.find(
                        (item) => item.id === scan.business_id
                      );

                      const qr = qrCards.find(
                        (item) => item.id === scan.qr_card_id
                      );

                      const agent = scan.user_agent ?? "";
                      const device = !agent
                        ? "Tidak diketahui"
                        : /ipad|tablet/i.test(agent)
                          ? "Tablet"
                          : /mobile|android|iphone/i.test(agent)
                            ? "Ponsel"
                            : "Komputer";

                      return (
                        <tr
                          key={scan.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-4 pr-4 font-medium text-gray-900">
                            {business?.name ?? "Bisnis tidak ditemukan"}
                          </td>
                          <td className="py-4 pr-4 text-gray-600">
                            {qr?.code ?? qr?.serial_number ?? "-"}
                          </td>
                          <td className="whitespace-nowrap py-4 pr-4 text-gray-600">
                            {new Date(scan.scanned_at).toLocaleString(
                              "id-ID",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "Asia/Jakarta",
                              }
                            )}
                          </td>
                          <td className="py-4 text-gray-600">{device}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <p className="text-sm text-gray-500">
                  Halaman {currentPage} dari {totalPages}
                  {" · "}
                  {totalScans.toLocaleString("id-ID")} scan
                </p>

                <div className="flex gap-2">
                  {currentPage > 1 ? (
                    <Link
                      href={
                        currentPage === 2
                          ? "/protected/scans"
                          : `/protected/scans?page=${currentPage - 1}`
                      }
                      className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Sebelumnya
                    </Link>
                  ) : (
                    <span className="rounded-lg border px-4 py-2 text-sm text-gray-400">
                      Sebelumnya
                    </span>
                  )}

                  {currentPage < totalPages ? (
                    <Link
                      href={`/protected/scans?page=${currentPage + 1}`}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Berikutnya
                    </Link>
                  ) : (
                    <span className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-400">
                      Berikutnya
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
