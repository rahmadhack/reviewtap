import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SetupBody = {
  qrCardId?: string;
  businessId?: string;
  googleReviewUrl?: string;
};

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    // =======================================================
    // 1. USER
    // =======================================================

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Anda harus login terlebih dahulu.",
        },
        {
          status: 401,
        }
      );
    }

    // =======================================================
    // 2. BODY
    // =======================================================

    const body =
      (await request.json()) as SetupBody;

    const qrCardId =
      body.qrCardId?.trim();

    const businessId =
      body.businessId?.trim();

    const googleReviewUrl =
      body.googleReviewUrl?.trim();

    if (
      !qrCardId ||
      !businessId ||
      !googleReviewUrl
    ) {
      return NextResponse.json(
        {
          error:
            "Data setup QR belum lengkap.",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // 3. VALIDASI URL
    // =======================================================

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(
        googleReviewUrl
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "Google Review URL tidak valid.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      parsedUrl.protocol !==
        "http:" &&
      parsedUrl.protocol !==
        "https:"
    ) {
      return NextResponse.json(
        {
          error:
            "Google Review URL harus menggunakan HTTP atau HTTPS.",
        },
        {
          status: 400,
        }
      );
    }

    // =======================================================
    // 4. MEMBERSHIP
    // =======================================================

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("organization_members")
      .select(
        "organization_id, role"
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (
      membershipError ||
      !membership
    ) {
      return NextResponse.json(
        {
          error:
            "Organization tidak ditemukan.",
        },
        {
          status: 403,
        }
      );
    }

    // =======================================================
    // 5. HANYA OWNER / ADMIN
    // =======================================================

    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Hanya Owner atau Admin yang dapat mengaktifkan QR.",
        },
        {
          status: 403,
        }
      );
    }

    // =======================================================
    // 6. CEK QR
    // =======================================================

    const {
      data: qrCard,
      error: qrError,
    } = await supabase
      .from("qr_cards")
      .select(
        "id, code, status, business_id"
      )
      .eq("id", qrCardId)
      .maybeSingle();

    if (qrError) {
      console.error(
        "QR setup API lookup error:",
        qrError
      );

      return NextResponse.json(
        {
          error:
            "Gagal mengambil QR Code.",
        },
        {
          status: 500,
        }
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        {
          error:
            "QR Code tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // =======================================================
    // 7. QR HARUS EMPTY
    // =======================================================

    if (
      qrCard.status !== "empty" ||
      qrCard.business_id
    ) {
      return NextResponse.json(
        {
          error:
            "QR Code ini sudah digunakan atau tidak tersedia.",
        },
        {
          status: 409,
        }
      );
    }

    // =======================================================
    // 8. CEK BUSINESS
    // =======================================================

    const {
      data: business,
      error: businessError,
    } = await supabase
      .from("businesses")
      .select(
        "id, organization_id"
      )
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "QR setup business lookup error:",
        businessError
      );

      return NextResponse.json(
        {
          error:
            "Gagal mengambil bisnis.",
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
            "Bisnis tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    // =======================================================
    // 9. BUSINESS HARUS MILIK ORGANISASI USER
    // =======================================================

    if (
      business.organization_id !==
      membership.organization_id
    ) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke bisnis ini.",
        },
        {
          status: 403,
        }
      );
    }

    // =======================================================
    // 10. SIMPAN GOOGLE REVIEW URL
    // =======================================================

    const {
      error: updateBusinessError,
    } = await supabase
      .from("businesses")
      .update({
        google_review_url:
          googleReviewUrl,
      })
      .eq("id", businessId)
      .eq(
        "organization_id",
        membership.organization_id
      );

    if (updateBusinessError) {
      console.error(
        "QR setup business update error:",
        updateBusinessError
      );

      return NextResponse.json(
        {
          error:
            "Gagal menyimpan Google Review URL.",
        },
        {
          status: 500,
        }
      );
    }

    // =======================================================
    // 11. AKTIFKAN QR
    //
    // Gunakan endpoint activate yang SUDAH ada.
    // Jadi mekanisme aktivasi lama tetap dipakai.
    //
    // =======================================================

    const activateUrl =
      new URL(
        "/api/qr-codes/activate",
        request.url
      );

    const cookieHeader =
      request.headers.get("cookie");

    const activateResponse =
      await fetch(activateUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          ...(cookieHeader
            ? {
                cookie: cookieHeader,
              }
            : {}),
        },
        body: JSON.stringify({
          qrCardId,
          businessId,
        }),
      });

    const activateResult =
      await activateResponse
        .json()
        .catch(() => null);

    if (!activateResponse.ok) {
      console.error(
        "QR activate error:",
        activateResult
      );

      return NextResponse.json(
        {
          error:
            activateResult?.error ??
            "Gagal mengaktifkan QR Code.",
        },
        {
          status:
            activateResponse.status ||
            500,
        }
      );
    }

    // =======================================================
    // 12. SELESAI
    // =======================================================

    return NextResponse.json({
      success: true,
      message:
        "QR Code berhasil diaktifkan.",
      qrCardId,
      businessId,
    });
  } catch (error) {
    console.error(
      "QR setup API error:",
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