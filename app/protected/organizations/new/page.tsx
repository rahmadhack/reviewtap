import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  async function createOrganization(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const name = String(formData.get("name") || "").trim();

    if (!name) {
      throw new Error("Nama organisasi wajib diisi.");
    }

    const { error } = await supabase.rpc("create_organization", {
      organization_name: name,
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/protected/businesses");
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Buat Organisasi
          </h1>

          <p className="mt-2 text-gray-600">
            Buat organisasi terlebih dahulu sebelum menambahkan bisnis.
          </p>
        </div>

        <form
          action={createOrganization}
          className="rounded-2xl bg-white p-8 shadow-sm"
        >
          <div>
            <label
              htmlFor="name"
              className="mb-2 block font-medium text-gray-900"
            >
              Nama Organisasi
            </label>

            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Contoh: ReviewTap Indonesia"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />

            <p className="mt-2 text-sm text-gray-500">
              Nama organisasi dapat berupa nama usaha, perusahaan, atau
              kelompok bisnis Anda.
            </p>
          </div>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Buat Organisasi
          </button>
        </form>
      </div>
    </main>
  );
}