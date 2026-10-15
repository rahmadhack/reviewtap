import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OWNER_USER_ID = "6254768d-5805-41e3-8f03-b168081f9102";
const OWNER_ORGANIZATION_ID = "2a3a6d01-73ac-4656-b8e7-2c4208593362";

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // Pastikan pengguna sudah login.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // Ambil kode QR dari request.
    const body = await request.json().catch(() => null);
    const code =
      typeof body?.code === "string" ? body.code.trim() : "";

    if (!code) {
      return NextResponse.json(
        { error: "Kode QR tidak valid." },
        { status: 400 }
      );
    }

    // Cari QR yang akan dihapus.
    const { data: qrCard, error: qrError } = await supabase
      .from("qr_cards")
      .select(
        "id, code, status, business_id, google_place_id, organization_id, reseller_user_id, destination_type"
      )
      .eq("code", code)
      .maybeSingle();

    if (qrError) {
      console.error("Gagal mengambil data QR:", qrError);

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

    // Periksa hak akses owner atau reseller.
    const isOwner = user.id === OWNER_USER_ID;

    let isAuthorizedReseller = false;

    if (!isOwner && qrCard.reseller_user_id === user.id) {
      const { data: memberships, error: membershipError } =
        await supabase
          .from("organization_members")
          .select("user_id, organization_id, role")
          .eq("user_id", user.id)
          .eq("organization_id", qrCard.organization_id)
          .eq("role", "reseller");

      if (membershipError) {
        console.error(
          "Gagal memeriksa keanggotaan reseller:",
          membershipError
        );

        return NextResponse.json(
          { error: "Gagal memeriksa hak akses QR." },
          { status: 500 }
        );
      }

      isAuthorizedReseller = (memberships?.length ?? 0) === 1;
    }

    if (!isOwner && !isAuthorizedReseller) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menghapus QR ini." },
        { status: 403 }
      );
    }

    // Owner hanya boleh mengelola QR dalam organisasi miliknya.
    if (isOwner && qrCard.organization_id !== OWNER_ORGANIZATION_ID) {
      return NextResponse.json(
        { error: "QR ini bukan milik organisasi owner." },
        { status: 403 }
      );
    }

    // Tentukan jenis QR yang valid untuk dihapus.
    const isEmptyQR =
      qrCard.status === "empty" &&
      !qrCard.business_id &&
      !qrCard.google_place_id;

    const isActiveCustomLink =
      qrCard.status === "active" &&
      qrCard.destination_type === "custom_link" &&
      !qrCard.business_id &&
      !qrCard.google_place_id;

    const isActiveGoogleReview =
      qrCard.status === "active" &&
      qrCard.destination_type === "google_review" &&
      Boolean(qrCard.business_id) &&
      Boolean(qrCard.google_place_id);

    if (!isEmptyQR && !isActiveCustomLink && !isActiveGoogleReview) {
      return NextResponse.json(
        { error: "QR ini tidak dapat dihapus." },
        { status: 400 }
      );
    }

    // Untuk QR Google Review, pastikan bisnisnya valid
    // dan berada di organisasi yang sama dengan QR.
    if (isActiveGoogleReview) {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id, organization_id")
        .eq("id", qrCard.business_id)
        .maybeSingle();

      if (businessError) {
        console.error("Gagal memeriksa bisnis QR:", businessError);

        return NextResponse.json(
          { error: "Gagal memeriksa data bisnis QR." },
          { status: 500 }
        );
      }

      if (
        !business ||
        business.organization_id !== qrCard.organization_id
      ) {
        return NextResponse.json(
          { error: "Bisnis QR tidak valid atau tidak sesuai organisasi." },
          { status: 403 }
        );
      }
    }

    // Hapus QR hanya jika kode dan ID-nya cocok.
    const { data: deletedQR, error: deleteError } = await supabase
      .from("qr_cards")
      .delete()
      .eq("id", qrCard.id)
      .eq("code", code)
      .select("id, code");

    if (deleteError) {
      console.error("Gagal menghapus QR:", {
        code,
        error: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
        codeError: deleteError.code,
      });

      return NextResponse.json(
        {
          error: "Gagal menghapus QR dari database.",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    if (!deletedQR || deletedQR.length === 0) {
      return NextResponse.json(
        {
          error:
            "QR tidak terhapus. Periksa izin akses database atau kebijakan RLS.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QR berhasil dihapus.",
      code,
    });
  } catch (error) {
    console.error("Error pada API hapus QR:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan saat menghapus QR." },
      { status: 500 }
    );
  }
}
