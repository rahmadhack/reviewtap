import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(pin, salt, 64)
    .toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function createSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = crypto
    .randomBytes(4)
    .toString("hex");

  return `${base || "business"}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    /*
     * User harus login.
     */
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const code = String(body.code || "").trim();

    const organizationId = String(
      body.organization_id || ""
    ).trim();

    const googlePlaceId = String(
      body.google_place_id || ""
    ).trim();

    const googleBusinessName = String(
      body.google_business_name || ""
    ).trim();

    const googleBusinessAddress = String(
      body.google_business_address || ""
    ).trim();

    const googleMapsUrl = String(
      body.google_maps_url || ""
    ).trim();

    const pin = String(body.pin || "").trim();

    /*
     * Validasi dasar.
     */
    if (!code) {
      return NextResponse.json(
        {
          error: "QR Code wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        {
          error: "Organization ID wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (!googlePlaceId) {
      return NextResponse.json(
        {
          error: "Bisnis Google wajib dipilih.",
        },
        {
          status: 400,
        }
      );
    }

    if (!googleBusinessName) {
      return NextResponse.json(
        {
          error: "Nama bisnis wajib diisi.",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        {
          error: "PIN harus terdiri dari 4 digit.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Pastikan user adalah owner/admin
     * dari organisasi yang dikirim.
     */
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (membershipError) {
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
            "Anda tidak memiliki izin untuk mengaktifkan QR pada organisasi ini.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * Ambil QR.
     */
    const {
      data: qrCard,
      error: qrError,
    } = await supabase
      .from("qr_cards")
      .select(
        "id, serial_number, code, status, business_id"
      )
      .eq("code", code)
      .maybeSingle();

    if (qrError) {
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
          error: "QR Code tidak ditemukan.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * QR harus benar-benar kosong.
     */
    if (qrCard.status !== "empty") {
      return NextResponse.json(
        {
          error:
            "QR Code ini sudah pernah diaktifkan.",
        },
        {
          status: 400,
        }
      );
    }

    if (qrCard.business_id) {
      return NextResponse.json(
        {
          error:
            "QR Code ini sudah terhubung dengan bisnis.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Google review URL.
     *
     * Place ID digunakan sebagai identitas bisnis.
     */
    const googleReviewUrl =
      `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
        googlePlaceId
      )}`;

    /*
     * Cari bisnis yang sudah memiliki Place ID tersebut
     * dalam organisasi ini.
     */
    const {
      data: existingBusiness,
      error: existingBusinessError,
    } = await supabase
      .from("businesses")
      .select(
        "id, name, google_place_id, google_review_url"
      )
      .eq("organization_id", organizationId)
      .eq("google_place_id", googlePlaceId)
      .maybeSingle();

    if (existingBusinessError) {
      return NextResponse.json(
        {
          error: existingBusinessError.message,
        },
        {
          status: 500,
        }
      );
    }

    let businessId: string;

    /*
     * Kalau bisnis sudah ada, gunakan bisnis tersebut.
     */
    if (existingBusiness) {
      businessId = existingBusiness.id;

      /*
       * Pastikan review URL tersedia.
       */
      const { error: businessUpdateError } =
        await supabase
          .from("businesses")
          .update({
            name: googleBusinessName,
            address:
              googleBusinessAddress || null,
            google_review_url:
              existingBusiness.google_review_url ||
              googleReviewUrl,
            google_place_id: googlePlaceId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingBusiness.id);

      if (businessUpdateError) {
        return NextResponse.json(
          {
            error: businessUpdateError.message,
          },
          {
            status: 500,
          }
        );
      }
    } else {
      /*
       * Bisnis belum ada di organisasi.
       * Buat bisnis baru.
       */
      const slug = createSlug(
        googleBusinessName
      );

      const { data: newBusiness, error: createError } =
        await supabase
          .from("businesses")
          .insert({
            organization_id: organizationId,
            name: googleBusinessName,
            slug,
            address:
              googleBusinessAddress || null,
            google_review_url: googleReviewUrl,
            google_place_id: googlePlaceId,
          })
          .select(
            "id, name, google_review_url, google_place_id"
          )
          .single();

      if (createError) {
        return NextResponse.json(
          {
            error: createError.message,
          },
          {
            status: 500,
          }
        );
      }

      businessId = newBusiness.id;
    }

    /*
     * Hash PIN.
     */
    const pinHash = hashPin(pin);

    const now = new Date().toISOString();

    /*
     * Aktifkan QR.
     *
     * Kondisi status=empty + business_id=null
     * mencegah aktivasi ganda secara sederhana.
     */
    const {
      data: updatedQR,
      error: updateError,
    } = await supabase
      .from("qr_cards")
      .update({
        business_id: businessId,
        status: "active",
        google_place_id: googlePlaceId,
        pin_hash: pinHash,
        activated_at: now,
        deactivated_at: null,
        updated_at: now,
      })
      .eq("id", qrCard.id)
      .eq("status", "empty")
      .is("business_id", null)
      .select(
        "id, serial_number, code, status, business_id, google_place_id, activated_at"
      )
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Simpan history aktivasi.
     */
    const {
      error: historyError,
    } = await supabase
      .from("qr_activation_history")
      .insert({
        qr_card_id: qrCard.id,
        business_id: businessId,
        google_review_url: googleReviewUrl,
        activated_at: now,
        deactivated_at: null,
        activated_by: user.id,
      });

    if (historyError) {
      /*
       * Rollback QR kalau history gagal.
       */
      await supabase
        .from("qr_cards")
        .update({
          status: "empty",
          business_id: null,
          google_place_id: null,
          pin_hash: null,
          activated_at: null,
          deactivated_at: null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", qrCard.id);

      return NextResponse.json(
        {
          error:
            "QR gagal diaktifkan karena riwayat aktivasi gagal disimpan.",
          detail: historyError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "QR Code berhasil diaktifkan.",
      qrCard: updatedQR,
      business: {
        id: businessId,
        name: googleBusinessName,
        google_place_id: googlePlaceId,
        google_review_url: googleReviewUrl,
      },
    });
  } catch (error) {
    console.error(
      "QR activation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan.",
      },
      {
        status: 500,
      }
    );
  }
}