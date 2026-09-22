import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function EditBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  // =========================
  // USER
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

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    redirect("/protected/businesses");
  }

  // =========================
  // BUSINESS
  // =========================

  const {
    data: business,
    error: businessError,
  } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .eq(
      "organization_id",
      membership.organization_id
    )
    .single();

  if (businessError || !business) {
    notFound();
  }

  // =========================
  // UPDATE BUSINESS
  // =========================

  async function updateBusiness(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    // =========================
    // CHECK MEMBERSHIP
    // =========================

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

    if (membershipError) {
      throw new Error(
        membershipError.message
      );
    }

    if (!membership) {
      throw new Error(
        "Anda tidak memiliki izin mengedit bisnis."
      );
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

    if (googleReviewUrl) {
      try {
        new URL(googleReviewUrl);
      } catch {
        throw new Error(
          "Google Review URL tidak valid."
        );
      }
    }

    // =========================
    // UPDATE
    // =========================

    const { error: updateError } =
      await supabase
        .from("businesses")
        .update({
          name,
          address,
          phone,
          google_review_url:
            googleReviewUrl || null,
        })
        .eq("id", id)
        .eq(
          "organization_id",
          membership.organization_id
        );

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    // =========================
    // SUCCESS
    // =========================

    redirect(
      `/protected/businesses/${id}`
    );
  }

  // =========================
  // RENDER
  // =========================

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* BACK */}

        <Link
          href={`/protected/businesses/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Kembali ke Bisnis
        </Link>

        {/* HEADER */}

        <div className="mt-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Edit Bisnis
          </h1>

          <p className="mt-2 text-gray-600">
            Ubah informasi bisnis Anda.
          </p>
        </div>

        {/* FORM */}

        <form
          action={updateBusiness}
          className="mt-8 space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >

          {/* NAME */}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nama Bisnis
            </label>

            <input
              id="name"
              name="name"
              type="text"
              defaultValue={
                business.name ?? ""
              }
              required
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Contoh: Cafe Maju"
            />
          </div>

          {/* ADDRESS */}

          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700"
            >
              Alamat
            </label>

            <textarea
              id="address"
              name="address"
              defaultValue={
                business.address ?? ""
              }
              rows={3}
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Masukkan alamat bisnis"
            />
          </div>

          {/* PHONE */}

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              Nomor Telepon
            </label>

            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={
                business.phone ?? ""
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Contoh: 088245621406"
            />
          </div>

          {/* GOOGLE REVIEW */}

          <div>
            <label
              htmlFor="google_review_url"
              className="block text-sm font-medium text-gray-700"
            >
              Google Review URL
            </label>

            <input
              id="google_review_url"
              name="google_review_url"
              type="url"
              defaultValue={
                business.google_review_url ?? ""
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="https://g.page/r/..."
            />

            <p className="mt-2 text-sm text-gray-500">
              Link ini digunakan oleh QR Code dan
              NFC untuk mengarahkan pelanggan ke
              Google Review.
            </p>
          </div>

          {/* ACTIONS */}

          <div className="flex gap-3 border-t pt-6">

            <Link
              href={`/protected/businesses/${id}`}
              className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Simpan Perubahan
            </button>

          </div>

        </form>

      </div>
    </main>
  );
}