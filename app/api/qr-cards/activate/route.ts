import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ActivateRequest = {
  code?: string;
  business_id?: string;

  // Format lama / alternatif
  qrCardId?: string;
  businessId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // =========================================================
    // 1. Pastikan user sudah login
    // =========================================================
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    // =========================================================
    // 2. Ambil body request
    // =========================================================
    let body: ActivateRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Data request tidak valid.",
        },
        { status: 400 },
      );
    }

    /*
     * Endpoint menerima dua format:
     *
     * Format baru:
     * {
     *   code: "RT-000003",
     *   business_id: "..."
     * }
     *
     * Format lama:
     * {
     *   qrCardId: "...",
     *   businessId: "..."
     * }
     */

    const code = body.code?.trim() || "";
    const businessId =
      body.business_id?.trim() ||
      body.businessId?.trim() ||
      "";

    const qrCardId =
      body.qrCardId?.trim() || "";

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "Bisnis wajib dipilih.",
        },
        { status: 400 },
      );
    }

    if (!code && !qrCardId) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code wajib dipilih.",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 3. Periksa QR Code
    // =========================================================
    let qrQuery = supabase
      .from("qr_cards")
      .select(
        "id, code, serial_number, status, business_id, activated_at",
      );

    if (code) {
      qrQuery = qrQuery.eq("code", code);
    } else {
      qrQuery = qrQuery.eq("id", qrCardId);
    }

    const {
      data: qrCard,
      error: qrError,
    } = await qrQuery.maybeSingle();

    if (qrError) {
      console.error(
        "QR lookup error:",
        qrError,
      );

      return NextResponse.json(
        {
          success: false,
          message: "QR Code tidak dapat diperiksa.",
        },
        { status: 500 },
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    // =========================================================
    // 4. QR hanya boleh diaktifkan jika masih empty
    // =========================================================
    if (qrCard.status !== "empty") {
      if (qrCard.status === "active") {
        return NextResponse.json(
          {
            success: false,
            message: "QR Code ini sudah aktif.",
          },
          { status: 409 },
        );
      }

      if (qrCard.status === "disabled") {
        return NextResponse.json(
          {
            success: false,
            message:
              "QR Code ini sedang dinonaktifkan.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "QR Code tidak dapat diaktifkan.",
        },
        { status: 409 },
      );
    }

    // =========================================================
    // 5. Periksa bisnis
    // =========================================================
    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select(
        "id, name, organization_id, google_review_url",
      )
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "Business lookup error:",
        businessError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Bisnis tidak dapat diperiksa.",
        },
        { status: 500 },
      );
    }

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bisnis tidak ditemukan atau Anda tidak memiliki akses ke bisnis tersebut.",
        },
        { status: 404 },
      );
    }

    // =========================================================
    // 6. Pastikan user adalah anggota organisasi
    // =========================================================
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("organization_members")
      .select(
        "organization_id, role",
      )
      .eq("user_id", user.id)
      .eq(
        "organization_id",
        business.organization_id,
      )
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "Membership lookup error:",
        membershipError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Membership organisasi tidak dapat diperiksa.",
        },
        { status: 500 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Anda tidak memiliki akses ke bisnis tersebut.",
        },
        { status: 403 },
      );
    }

    // =========================================================
    // 7. Hanya Owner / Admin
    // =========================================================
    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Owner atau Admin yang dapat mengaktifkan QR.",
        },
        { status: 403 },
      );
    }

    // =========================================================
    // 8. Bisnis harus memiliki Google Review URL
    // =========================================================
    const googleReviewUrl =
      business.google_review_url?.trim();

    if (!googleReviewUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bisnis ini belum memiliki Google Review URL.",
        },
        { status: 422 },
      );
    }

    // =========================================================
    // 9. Update QR Card
    // =========================================================
    const now =
      new Date().toISOString();

    const {
      data: updatedQr,
      error: updateError,
    } = await supabase
      .from("qr_cards")
      .update({
        status: "active",
        business_id: business.id,
        activated_at: now,
        deactivated_at: null,
        updated_at: now,
      })
      .eq("id", qrCard.id)
      .eq("status", "empty")
      .select(
        "id, code, serial_number, status, business_id, activated_at",
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "QR update error:",
        updateError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "QR gagal diaktifkan. Pastikan izin database sudah benar.",
        },
        { status: 500 },
      );
    }

    if (!updatedQr) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR gagal diaktifkan karena status QR sudah berubah. Silakan refresh halaman.",
        },
        { status: 409 },
      );
    }

    // =========================================================
    // 10. Simpan history aktivasi
    // =========================================================
    const {
      error: historyError,
    } = await supabase
      .from("qr_activation_history")
      .insert({
        qr_card_id: qrCard.id,
        business_id: business.id,
        google_review_url: googleReviewUrl,
        activated_at: now,
        deactivated_at: null,
        activated_by: user.id,
      });

    // =========================================================
    // 11. Jika history gagal, rollback QR
    // =========================================================
    if (historyError) {
      console.error(
        "QR activation history error:",
        historyError,
      );

      await supabase
        .from("qr_cards")
        .update({
          status: "empty",
          business_id: null,
          activated_at: null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", qrCard.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "Aktivasi dibatalkan karena riwayat aktivasi gagal disimpan.",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 12. Berhasil
    // =========================================================
    return NextResponse.json({
      success: true,
      message:
        "QR Code berhasil diaktifkan.",
      data: {
        qr_code: updatedQr.code,
        serial_number:
          updatedQr.serial_number,
        business_id: business.id,
        business_name: business.name,
        google_review_url:
          googleReviewUrl,
        activated_at:
          updatedQr.activated_at,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected QR activation error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
}