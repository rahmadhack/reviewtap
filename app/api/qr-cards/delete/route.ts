import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: Request
) {
  try {
    const supabase = await createClient();

    // =========================================================
    // 1. CEK USER
    // =========================================================

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Anda harus login.",
        },
        {
          status: 401,
        }
      );
    }

    // =========================================================
    // 2. CEK ORGANIZATION + ROLE
    // =========================================================

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
      console.error(
        "Delete QR membership error:",
        membershipError
      );

      return NextResponse.json(
        {
          error: membershipError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki izin untuk menghapus QR.",
        },
        {
          status: 403,
        }
      );
    }

    const organizationId =
      membership.organization_id;

    // =========================================================
    // 3. BACA CODE QR
    // =========================================================

    let body: {
      code?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Data QR tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    const code = body?.code?.trim();

    if (!code) {
      return NextResponse.json(
        {
          error: "Kode QR wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================================
    // 4. CARI QR
    // =========================================================

    const {
      data: qrCard,
      error: qrError,
    } = await supabase
      .from("qr_cards")
      .select(
        "id, code, status, business_id, google_place_id"
      )
      .eq("code", code)
      .maybeSingle();

    if (qrError) {
      console.error(
        "Delete QR lookup error:",
        qrError
      );

      return NextResponse.json(
        {
          error: qrError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        {
          error: "QR tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // =========================================================
    // 5. CEK AKSES QR
    // =========================================================

    if (
      qrCard.status === "empty" &&
      !qrCard.business_id
    ) {
      // QR kosong boleh dihapus oleh owner/admin.
    } else if (
      qrCard.status === "active" &&
      qrCard.business_id
    ) {
      // QR aktif harus terhubung ke business
      // milik organization user.

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select("id, organization_id")
        .eq(
          "id",
          qrCard.business_id
        )
        .maybeSingle();

      if (businessError) {
        console.error(
          "Delete QR business lookup error:",
          businessError
        );

        return NextResponse.json(
          {
            error: businessError.message,
          },
          {
            status: 500,
          }
        );
      }

      if (!business) {
        return NextResponse.json(
          {
            error:
              "Business QR tidak ditemukan.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        business.organization_id !==
        organizationId
      ) {
        return NextResponse.json(
          {
            error:
              "Anda tidak memiliki akses ke QR ini.",
          },
          {
            status: 403,
          }
        );
      }
    } else {
      return NextResponse.json(
        {
          error:
            "QR ini tidak dapat dihapus.",
        },
        {
          status: 400,
        }
      );
    }

    // =========================================================
    // 6. HAPUS QR
    //
    // Histori scan tetap dipertahankan.
    // qr_scan_events.qr_card_id akan menjadi NULL
    // karena foreign key menggunakan ON DELETE SET NULL.
    //
    // Business TIDAK ikut dihapus.
    // =========================================================

    const {
      error: deleteError,
    } = await supabase
      .from("qr_cards")
      .delete()
      .eq("id", qrCard.id);

    if (deleteError) {
      console.error(
        "Delete QR error:",
        deleteError
      );

      return NextResponse.json(
        {
          error: deleteError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        code: qrCard.code,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Delete QR unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      }
    );
  }
}