import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkQrPinRateLimit,
  recordQrPinFailure,
  clearQrPinFailures,
} from "@/lib/security/qr-pin-rate-limit";

type ActivateRequest = {
  code?: string;
  current_pin?: string;

  google_place_id?: string;
  google_business_name?: string;
  google_business_address?: string;
  google_maps_url?: string;

  new_pin?: string;
};

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(pin, salt, 64)
    .toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function verifyPin(pin: string, storedHash: string | null) {
  if (!storedHash) return false;

  const parts = storedHash.split(":");

  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = parts[1];
  const expectedHash = parts[2];

  try {
    const actualHash = crypto
      .scryptSync(pin, salt, 64)
      .toString("hex");

    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    );
  } catch {
    return false;
  }
}

function createGoogleReviewUrl(googlePlaceId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
    googlePlaceId,
  )}`;
}

function createBusinessSlug(
  name: string,
  googlePlaceId: string,
) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  const placeSuffix = googlePlaceId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(-8);

  return `${baseSlug}-${placeSuffix}`;
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

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

    const code = String(body.code || "").trim();
    const currentPin = String(body.current_pin || "").trim();

    const googlePlaceId = String(
      body.google_place_id || "",
    ).trim();

    const googleBusinessName = String(
      body.google_business_name || "",
    ).trim();

    const googleBusinessAddress = String(
      body.google_business_address || "",
    ).trim();

    const googleMapsUrl = String(
      body.google_maps_url || "",
    ).trim();

    const newPin = String(body.new_pin || "").trim();

    // =========================================================
    // 1. Validasi input
    // =========================================================

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code wajib diisi.",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 2. Rate limit PIN
    // =========================================================

    const rateLimit = await checkQrPinRateLimit(
      request,
      code,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Terlalu banyak percobaan. Silakan coba lagi nanti.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.retryAfterSeconds || 900,
            ),
          },
        },
      );
    }

    if (!/^\d{4}$/.test(currentPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN Saat Ini harus terdiri dari 4 digit.",
        },
        { status: 400 },
      );
    }

    if (!googlePlaceId) {
      return NextResponse.json(
        {
          success: false,
          message: "Bisnis Google wajib dipilih.",
        },
        { status: 400 },
      );
    }

    if (!googleBusinessName) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama bisnis Google wajib diisi.",
        },
        { status: 400 },
      );
    }

    if (newPin && !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN Baru harus terdiri dari 4 digit.",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 3. Cari QR Card
    // =========================================================

    const { data: qrCard, error: qrCardError } =
      await supabase
        .from("qr_cards")
        .select(
          `
            id,
            code,
            serial_number,
            status,
            business_id,
            organization_id,
            pin_hash,
            activated_at
          `,
        )
        .eq("code", code)
        .maybeSingle();

    if (qrCardError) {
      console.error(
        "QR card lookup error:",
        qrCardError,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Gagal membaca QR Card.",
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
    // 4. Pastikan QR masih kosong
    // =========================================================

    if (qrCard.status !== "empty") {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini sudah aktif atau tidak dapat diaktifkan.",
        },
        { status: 409 },
      );
    }

    if (qrCard.business_id !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini sudah terhubung dengan bisnis.",
        },
        { status: 409 },
      );
    }

    if (!qrCard.organization_id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini belum memiliki organisasi. Silakan hubungi Admin.",
        },
        { status: 422 },
      );
    }

    // =========================================================
    // 5. Verifikasi PIN Saat Ini
    // =========================================================

    const pinIsValid = verifyPin(
      currentPin,
      qrCard.pin_hash,
    );

    if (!pinIsValid) {
      await recordQrPinFailure(request, code);

      return NextResponse.json(
        {
          success: false,
          message: "PIN salah.",
        },
        { status: 403 },
      );
    }

    // PIN benar -> hapus counter percobaan
    await clearQrPinFailures(request, code);

    // =========================================================
    // 6. Buat Google Review URL
    // =========================================================

    const googleReviewUrl =
      createGoogleReviewUrl(googlePlaceId);

    // =========================================================
    // 7. Cari business yang sudah menggunakan Google Place ID
    // =========================================================

    const {
      data: existingBusiness,
      error: existingBusinessError,
    } = await supabase
      .from("businesses")
      .select(
        `
          id,
          name,
          google_place_id,
          google_review_url
        `,
      )
      .eq(
        "organization_id",
        qrCard.organization_id,
      )
      .eq("google_place_id", googlePlaceId)
      .maybeSingle();

    if (existingBusinessError) {
      console.error(
        "Business lookup error:",
        existingBusinessError,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Gagal memeriksa data bisnis.",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 8. Gunakan business lama atau buat business baru
    // =========================================================

    let businessId: string;
    let businessName: string;

    if (existingBusiness) {
      // -------------------------------------------------------
      // Business sudah ada
      // -------------------------------------------------------

      const {
        data: updatedBusiness,
        error: businessUpdateError,
      } = await supabase
        .from("businesses")
        .update({
          name: googleBusinessName,
          google_place_id: googlePlaceId,
          google_review_url: googleReviewUrl,
        })
        .eq("id", existingBusiness.id)
        .select(
          `
            id,
            name,
            google_place_id,
            google_review_url
          `,
        )
        .single();

      if (
        businessUpdateError ||
        !updatedBusiness
      ) {
        console.error(
          "Business update error:",
          businessUpdateError,
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Gagal memperbarui data bisnis.",
          },
          { status: 500 },
        );
      }

      businessId = updatedBusiness.id;
      businessName = updatedBusiness.name;
    } else {
      // -------------------------------------------------------
      // Business belum ada -> buat baru
      // -------------------------------------------------------

      const businessSlug = createBusinessSlug(
        googleBusinessName,
        googlePlaceId,
      );

      const {
        data: createdBusiness,
        error: businessCreateError,
      } = await supabase
        .from("businesses")
        .insert({
          organization_id:
            qrCard.organization_id,
          name: googleBusinessName,
          slug: businessSlug,
          google_place_id: googlePlaceId,
          google_review_url: googleReviewUrl,
        })
        .select(
          `
            id,
            name,
            google_place_id,
            google_review_url
          `,
        )
        .single();

      if (
        businessCreateError ||
        !createdBusiness
      ) {
        console.error(
          "Business create error:",
          businessCreateError,
        );

        return NextResponse.json(
          {
            success: false,
            message: "Bisnis gagal dibuat.",
          },
          { status: 500 },
        );
      }

      businessId = createdBusiness.id;
      businessName = createdBusiness.name;
    }

    // =========================================================
    // 9. Tentukan PIN baru
    // =========================================================

    const pinHash = newPin
      ? hashPin(newPin)
      : qrCard.pin_hash;

    // =========================================================
    // 10. Aktifkan QR Card
    // =========================================================

    const activatedAt =
      new Date().toISOString();

    const {
      data: updatedQrCard,
      error: qrUpdateError,
    } = await supabase
      .from("qr_cards")
      .update({
        status: "active",
        business_id: businessId,
        google_place_id: googlePlaceId,
        pin_hash: pinHash,
        activated_at: activatedAt,
        deactivated_at: null,
        updated_at: activatedAt,
      })
      .eq("id", qrCard.id)
      .eq("status", "empty")
      .select(
        `
          id,
          code,
          serial_number,
          status,
          business_id,
          google_place_id,
          activated_at
        `,
      )
      .maybeSingle();

    if (qrUpdateError) {
      console.error(
        "QR card update error:",
        qrUpdateError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card gagal diaktifkan.",
        },
        { status: 500 },
      );
    }

    if (!updatedQrCard) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card sudah berubah atau tidak dapat diaktifkan.",
        },
        { status: 409 },
      );
    }

    // =========================================================
    // 11. Simpan activation history
    // =========================================================

    const {
      error: historyError,
    } = await supabase
      .from("qr_activation_history")
      .insert({
        qr_card_id: qrCard.id,
        business_id: businessId,
        google_review_url: googleReviewUrl,
        activated_at: activatedAt,
        deactivated_at: null,
        activated_by: null,
      });

    if (historyError) {
      console.error(
        "QR activation history error:",
        historyError,
      );

      // Rollback status QR jika history gagal
      await supabase
        .from("qr_cards")
        .update({
          status: "empty",
          business_id: null,
          google_place_id: null,
          activated_at: null,
          deactivated_at: null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", qrCard.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "Aktivasi QR gagal disimpan. Silakan coba lagi.",
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
        "QR Card berhasil diaktifkan.",
      qr_code: updatedQrCard.code,
      serial_number:
        updatedQrCard.serial_number,
      business_id: businessId,
      business_name: businessName,
      google_place_id:
        googlePlaceId,
      google_review_url:
        googleReviewUrl,
      activated_at: activatedAt,
      pin_changed: Boolean(newPin),
    });
  } catch (error) {
    console.error(
      "QR activation unexpected error:",
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