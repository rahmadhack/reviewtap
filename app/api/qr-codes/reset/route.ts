import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkQrPinRateLimit,
  recordQrPinFailure,
  clearQrPinFailures,
} from "@/lib/security/qr-pin-rate-limit";

type ResetRequest = {
  code?: string;
  current_pin?: string;
};

const DEFAULT_PIN = "0808";

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

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    let body: ResetRequest;

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

    // =========================================================
    // 1. Validasi QR Code
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

    // =========================================================
    // 3. Validasi PIN
    // =========================================================

    if (!/^\d{4}$/.test(currentPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN harus terdiri dari 4 digit.",
        },
        { status: 400 },
      );
    }

    // =========================================================
    // 4. Cari QR Card
    // =========================================================

    const {
      data: qrCard,
      error: qrCardError,
    } = await supabase
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
          google_place_id,
          activated_at
        `,
      )
      .eq("code", code)
      .maybeSingle();

    if (qrCardError) {
      console.error(
        "QR reset lookup error:",
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
    // 5. Pastikan kartu sedang aktif
    // =========================================================

    if (qrCard.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini tidak sedang aktif.",
        },
        { status: 409 },
      );
    }

    // =========================================================
    // 6. Verifikasi PIN
    // =========================================================

    const pinIsValid = verifyPin(
      currentPin,
      qrCard.pin_hash,
    );

    if (!pinIsValid) {
      await recordQrPinFailure(
        request,
        code,
      );

      return NextResponse.json(
        {
          success: false,
          message: "PIN salah.",
        },
        { status: 403 },
      );
    }

    // PIN benar -> hapus counter percobaan
    await clearQrPinFailures(
      request,
      code,
    );

    // =========================================================
    // 7. Siapkan PIN default baru
    // =========================================================

    const defaultPinHash = hashPin(
      DEFAULT_PIN,
    );

    const resetAt =
      new Date().toISOString();

    // Simpan data lama untuk kemungkinan rollback
    const previousBusinessId =
      qrCard.business_id;

    const previousGooglePlaceId =
      qrCard.google_place_id;

    const previousActivatedAt =
      qrCard.activated_at;

    const previousPinHash =
      qrCard.pin_hash;

    // =========================================================
    // 8. Reset QR Card
    // =========================================================

    const {
      data: resetQrCard,
      error: resetQrError,
    } = await supabase
      .from("qr_cards")
      .update({
        status: "empty",
        business_id: null,
        google_place_id: null,
        pin_hash: defaultPinHash,
        activated_at: null,
        deactivated_at: resetAt,
        updated_at: resetAt,
      })
      .eq("id", qrCard.id)
      .eq("status", "active")
      .select(
        `
          id,
          code,
          serial_number,
          status,
          business_id,
          google_place_id,
          activated_at,
          deactivated_at
        `,
      )
      .maybeSingle();

    if (resetQrError) {
      console.error(
        "QR reset update error:",
        resetQrError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card gagal di-reset.",
        },
        { status: 500 },
      );
    }

    if (!resetQrCard) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card sudah berubah atau tidak dapat di-reset.",
        },
        { status: 409 },
      );
    }

    // =========================================================
    // 9. Tutup activation history
    // =========================================================

    const {
      error: historyError,
    } = await supabase
      .from("qr_activation_history")
      .update({
        deactivated_at: resetAt,
      })
      .eq("qr_card_id", qrCard.id)
      .is("deactivated_at", null);

    if (historyError) {
      console.error(
        "QR reset history error:",
        historyError,
      );

      // =======================================================
      // Rollback QR jika history gagal
      // =======================================================

      await supabase
        .from("qr_cards")
        .update({
          status: "active",
          business_id:
            previousBusinessId,
          google_place_id:
            previousGooglePlaceId,
          pin_hash:
            previousPinHash,
          activated_at:
            previousActivatedAt,
          deactivated_at: null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", qrCard.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "Reset gagal disimpan. Silakan coba lagi.",
        },
        { status: 500 },
      );
    }

    // =========================================================
    // 10. Berhasil
    // =========================================================

    return NextResponse.json({
      success: true,
      message:
        "QR Card berhasil di-reset.",
      qr_code: resetQrCard.code,
      serial_number:
        resetQrCard.serial_number,
      status: resetQrCard.status,
      reset_at: resetAt,
    });
  } catch (error) {
    console.error(
      "QR reset unexpected error:",
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