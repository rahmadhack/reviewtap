import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const instant = false;

export default async function NewBusinessPage() {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  async function createBusiness(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const name = String(formData.get("name") || "");
    const address = String(formData.get("address") || "");
    const phone = String(formData.get("phone") || "");
    const googleReviewUrl = String(
      formData.get("google_review_url") || ""
    );

    if (!name.trim()) {
      return;
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

    if (!membership) {
      throw new Error(
        "Anda tidak memiliki izin membuat bisnis."
      );
    }

    const slug =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 8);

    const { error } = await supabase
      .from("businesses")
      .insert({
        organization_id: membership.organization_id,
        name,
        slug,
        address,
        phone,
        google_review_url: googleReviewUrl,
      });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/protected/businesses");
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">

      <div className="mx-auto max-w-2xl">

        <h1 className="text-3xl font-bold">
          Tambah Bisnis
        </h1>

        <p className="mt-2 text-gray-500">
          Masukkan informasi bisnis Anda.
        </p>

        <form
          action={createBusiness}
          className="mt-8 space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >

          <div>
            <label className="mb-2 block font-medium">
              Nama Bisnis
            </label>

            <input
              name="name"
              required
              placeholder="Contoh: Cafe Maju"
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Alamat
            </label>

            <textarea
              name="address"
              placeholder="Alamat bisnis"
              className="w-full rounded-lg border px-4 py-3"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Nomor WhatsApp
            </label>

            <input
              name="phone"
              placeholder="08xxxxxxxxxx"
              className="w-full rounded-lg border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Google Review URL
            </label>

            <input
              name="google_review_url"
              type="url"
              placeholder="https://g.page/r/..."
              className="w-full rounded-lg border px-4 py-3"
            />

            <p className="mt-2 text-sm text-gray-500">
              Link ini akan digunakan oleh QR Code dan NFC.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Simpan Bisnis
          </button>

        </form>

      </div>

    </main>
  );
}