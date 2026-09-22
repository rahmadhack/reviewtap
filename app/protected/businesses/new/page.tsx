import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

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

    // =========================
    // FORM DATA
    // =========================

    const name = String(
      formData.get("name") || ""
    ).trim();

    const address = String(
      formData.get("address") || ""
    ).trim();

    const phone = String(
      formData.get("phone") || ""
    ).trim();

    const googleReviewUrl = String(
      formData.get("google_review_url") || ""
    ).trim();

    // =========================
    // VALIDATION
    // =========================

    if (!name) {
      throw new Error(
        "Nama bisnis wajib diisi."
      );
    }

    if (!googleReviewUrl) {
      throw new Error(
        "Google Review URL wajib diisi."
      );
    }

    try {
      new URL(googleReviewUrl);
    } catch {
      throw new Error(
        "Google Review URL tidak valid."
      );
    }

    // =========================
    // ORGANIZATION
    // =========================

    const { data: membership, error: membershipError } =
      await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      throw new Error(
        membershipError.message
      );
    }

    if (!membership) {
      throw new Error(
        "Anda tidak memiliki izin membuat bisnis."
      );
    }

    // =========================
    // SLUG
    // =========================

    const baseSlug =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const slug =
      `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

    // =========================
    // INSERT BUSINESS
    // =========================

    const { error: insertError } =
      await supabase
        .from("businesses")
        .insert({
          organization_id:
            membership.organization_id,
          name,
          slug,
          address,
          phone,
          google_review_url:
            googleReviewUrl,
        });

    if (insertError) {
      throw new Error(
        insertError.message
      );
    }

    // =========================
    // SUCCESS
    // =========================

    redirect("/protected/businesses");
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">

        {/* HEADER */}

        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Tambah Bisnis
          </h1>

          <p className="mt-2 text-gray-600">
            Masukkan informasi bisnis Anda.
          </p>
        </div>

        {/* FORM */}

        <form
          action={createBusiness}
          className="mt-8 space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >

          {/* NAMA */}

          <div>
            <label
              htmlFor="name"
              className="mb-2 block font-medium text-gray-900"
            >
              Nama Bisnis
            </label>

            <input
              id="name"
              name="name"
              required
              placeholder="Contoh: Cafe Maju"
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ALAMAT */}

          <div>
            <label
              htmlFor="address"
              className="mb-2 block font-medium text-gray-900"
            >
              Alamat
            </label>

            <textarea
              id="address"
              name="address"
              placeholder="Alamat bisnis"
              rows={3}
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* PHONE */}

          <div>
            <label
              htmlFor="phone"
              className="mb-2 block font-medium text-gray-900"
            >
              Nomor WhatsApp
            </label>

            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="08xxxxxxxxxx"
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* GOOGLE REVIEW */}

          <div>
            <label
              htmlFor="google_review_url"
              className="mb-2 block font-medium text-gray-900"
            >
              Google Review URL
            </label>

            <input
              id="google_review_url"
              name="google_review_url"
              type="url"
              required
              placeholder="https://g.page/r/..."
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />

            <p className="mt-2 text-sm text-gray-500">
              Link ini akan digunakan oleh QR Code
              dan NFC untuk mengarahkan pelanggan
              ke halaman Google Review.
            </p>
          </div>

          {/* SUBMIT */}

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