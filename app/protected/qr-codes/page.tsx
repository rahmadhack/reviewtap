import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import QRCodeDisplay from "./QRCodeDisplay";

export default async function QRCodesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  const organizationId = memberships?.[0]?.organization_id;

  if (!organizationId) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Organization belum ditemukan
            </h1>
          </div>
        </div>
      </main>
    );
  }

  const { data: businesses, error: businessError } =
    await supabase
      .from("businesses")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

  if (businessError) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Gagal mengambil data bisnis
            </h1>

            <p className="mt-2 text-gray-600">
              {businessError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const businessIds =
    businesses?.map((business) => business.id) || [];

  const { data: reviewLinks, error: reviewLinksError } =
    businessIds.length > 0
      ? await supabase
          .from("review_links")
          .select(
            "id, business_id, name, code, destination_url, is_active, created_at"
          )
          .in("business_id", businessIds)
          .order("created_at", {
            ascending: false,
          })
      : {
          data: [],
          error: null,
        };

  if (reviewLinksError) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-red-600">
              Gagal mengambil QR Code
            </h1>

            <p className="mt-2 text-gray-600">
              {reviewLinksError.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const qrData =
    reviewLinks?.map((link) => {
      const business = businesses?.find(
        (item) => item.id === link.business_id
      );

      return {
        ...link,
        businessName:
          business?.name || "Bisnis",
      };
    }) || [];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            QR Code
          </h1>

          <p className="mt-2 text-gray-600">
            Kelola QR Code untuk mengarahkan pelanggan
            ke Google Review.
          </p>
        </div>

        {/* DAFTAR QR */}
        <div className="mt-8">
          {qrData.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">
                Belum ada QR Code
              </h2>

              <p className="mt-2 text-gray-500">
                Buat QR Code terlebih dahulu.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {qrData.map((link) => (
                <QRCodeDisplay
                  key={link.id}
                  name={link.name}
                  code={link.code}
                  businessName={link.businessName}
                  isActive={link.is_active}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}