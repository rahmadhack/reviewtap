import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function BusinessesContent() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const organizationIds =
    memberships?.map((item) => item.organization_id) ?? [];

  if (organizationIds.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">Bisnis</h1>

          <p className="mt-2 text-gray-600">
            Anda belum memiliki organisasi.
          </p>

          <div className="mt-6 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold">
              Belum ada organisasi
            </h2>

            <p className="mt-2 text-gray-600">
              Buat organisasi terlebih dahulu sebelum menambahkan bisnis.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("*")
    .in("organization_id", organizationIds)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bisnis</h1>

            <p className="mt-2 text-gray-600">
              Kelola semua bisnis Anda.
            </p>
          </div>

          <a
            href="/protected/businesses/new"
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            + Tambah Bisnis
          </a>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {businesses?.map((business) => (
            <div
              key={business.id}
              className="rounded-xl bg-white p-6 shadow"
            >
              <h2 className="text-xl font-semibold">
                {business.name}
              </h2>

              <p className="mt-2 text-gray-600">
                {business.address}
              </p>

              <a
                href={`/protected/businesses/${business.id}`}
                className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white"
              >
                Kelola
              </a>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}