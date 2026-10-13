import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const OWNER_USER_ID = "6254768d-5805-41e3-8f03-b168081f9102";
const OWNER_ORGANIZATION_ID = "2a3a6d01-73ac-4656-b8e7-2c4208593362";

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Pastikan pengguna sudah login.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Anda harus login." },
        { status: 401 }
      );
    }

    const isOwner = user.id === OWNER_USER_ID;

    // 2. Baca kode QR.
    let body: { code?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Data QR tidak valid." },
        { status: 400 }
      );
    }

    const code = body?.code?.trim();

    if (!code) {
      return NextResponse.json(
        { error: "Kode QR wajib diisi." },
        { status: 400 }
      );
    }

    // 3. Cari QR.
    const {
      data: qrCard,
      error: qrError,
    } = await supabase
      .from("qr_cards")
      .select(
        "id, code, status, business_id, google_place_id, organization_id, reseller_user_id"
      )
      .eq("code", code)
      .maybeSingle();

    if (qrError) {
      console.error("Delete QR lookup error:", qrError);

      return NextResponse.json(
        { error: "Gagal mengambil data QR." },
        { status: 500 }
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        { error: "QR tidak ditemukan." },
        { status: 404 }
      );
    }

    // 4. Verifikasi kewenangan pengguna.
    let hasAccess = false;

    if (isOwner) {
      // Owner hanya mengelola QR di organisasi Owner yang ditetapkan.
      hasAccess =
        qrCard.organization_id === OWNER_ORGANIZATION_ID;
    } else {
      // Reseller hanya mengelola QR yang tercatat atas UID miliknya.
      hasAccess =
        qrCard.reseller_user_id === user.id;

      if (hasAccess) {
        const {
          data: memberships,
          error: membershipError,
        } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("role", "reseller")
          .eq("organization_id", qrCard.organization_id)
          .limit(2);

        if (membershipError) {
          console.error(
            "Delete QR membership error:",
            membershipError
          );

          return NextResponse.json(
            { error: "Gagal memverifikasi keanggotaan reseller." },
            { status: 500 }
          );
        }

        hasAccess = memberships?.length === 1;
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menghapus QR ini." },
        { status: 403 }
      );
    }

    // 5. Pastikan status QR bisa dihapus.
    if (
      qrCard.status === "empty" &&
      !qrCard.business_id
    ) {
      // QR kosong boleh dihapus pemilik yang sudah diverifikasi.
    } else if (
      qrCard.status === "active" &&
      qrCard.business_id
    ) {
      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select("id, organization_id")
        .eq("id", qrCard.business_id)
        .maybeSingle();

      if (businessError) {
        console.error(
          "Delete QR business lookup error:",
          businessError
        );

        return NextResponse.json(
          { error: "Gagal memverifikasi bisnis QR." },
          { status: 500 }
        );
      }

      if (!business) {
        return NextResponse.json(
          { error: "Bisnis QR tidak ditemukan." },
          { status: 404 }
        );
      }

      if (business.organization_id !== qrCard.organization_id) {
        return NextResponse.json(
          { error: "Organisasi bisnis tidak sesuai dengan QR." },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "QR ini tidak dapat dihapus." },
        { status: 400 }
      );
    }

    // 6. Hapus hanya QR yang sudah diverifikasi.
    // Riwayat scan dan data bisnis tidak dihapus secara langsung.
    const {
      error: deleteError,
    } = await supabase
      .from("qr_cards")
      .delete()
      .eq("id", qrCard.id)
      .eq("code", code);

    if (deleteError) {
      console.error("Delete QR error:", deleteError);

      return NextResponse.json(
        {
          error:
            "QR gagal dihapus. Periksa izin DELETE pada database.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, code: qrCard.code },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete QR unexpected error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}