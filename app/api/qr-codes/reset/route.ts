import { NextResponse } from "next/server";
import crypto from "crypto";

import { createClient } from "@/lib/supabase/server";
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

const OWNER_USER_ID = "6254768d-5805-41e3-8f03-b168081f9102";
const OWNER_ORGANIZATION_ID = "2a3a6d01-73ac-4656-b8e7-2c4208593362";
const DEFAULT_PIN = "0808";

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function verifyPin(pin: string, storedHash: string | null) {
  if (!storedHash) return false;

  const parts = storedHash.split(":");

  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  try {
    const actualHash = crypto
      .scryptSync(pin, parts[1], 64)
      .toString("hex");

    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(parts[2], "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // 1. Wajib login untuk mereset QR.
    const sessionClient = await createClient();

    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Silakan login sebelum mereset QR.",
        },
        { status: 401 }
      );
    }

    let body: ResetRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Data request tidak valid.",
        },
        { status: 400 }
      );
    }

    const code = String(body.code || "").trim();
    const currentPin = String(body.current_pin || "").trim();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(currentPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN harus terdiri dari 4 digit.",
        },
        { status: 400 }
      );
    }

    // 2. Baca QR menggunakan client server tepercaya.
    const admin = createAdminClient();

    const {
      data: qrCard,
      error: qrCardError,
    } = await admin
      .from("qr_cards")
      .select(
        "id, code, serial_number, status, business_id, organization_id, reseller_user_id, pin_hash, google_place_id, activated_at"
      )
      .eq("code", code)
      .maybeSingle();

    if (qrCardError) {
      console.error("QR reset lookup error:", qrCardError);

      return NextResponse.json(
        {
          success: false,
          message: "Gagal membaca QR Card.",
        },
        { status: 500 }
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // 3. Verifikasi kepemilikan sebelum memproses PIN.
    const isOwner = user.id === OWNER_USER_ID;

    let hasAccess = false;

    if (isOwner) {
      hasAccess =
        qrCard.organization_id === OWNER_ORGANIZATION_ID;
    } else if (qrCard.reseller_user_id === user.id) {
      const {
        data: memberships,
        error: membershipError,
      } = await sessionClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "reseller")
        .eq("organization_id", qrCard.organization_id)
        .limit(2);

      if (membershipError) {
        console.error(
          "QR reset membership error:",
          membershipError
        );

        return NextResponse.json(
          {
            success: false,
            message: "Gagal memverifikasi akun reseller.",
          },
          { status: 500 }
        );
      }

      hasAccess = memberships?.length === 1;
    }

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki akses untuk mereset QR ini.",
        },
        { status: 403 }
      );
    }

    // 4. QR aktif saja yang bisa di-reset.
    if (qrCard.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message: "QR Card ini tidak sedang aktif.",
        },
        { status: 409 }
      );
    }

    // 5. Rate limit dan verifikasi PIN.
    const rateLimit = await checkQrPinRateLimit(request, code);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.retryAfterSeconds || 900
            ),
          },
        }
      );
    }

    if (!verifyPin(currentPin, qrCard.pin_hash)) {
      await recordQrPinFailure(request, code);

      return NextResponse.json(
        {
          success: false,
          message: "PIN salah.",
        },
        { status: 403 }
      );
    }

    await clearQrPinFailures(request, code);

    // 6. Siapkan data reset.
    const defaultPinHash = hashPin(DEFAULT_PIN);
    const resetAt = new Date().toISOString();

    // 7. Reset hanya jika QR masih aktif dan belum berubah.
    const {
      data: resetQrCard,
      error: resetQrError,
    } = await admin
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
        "id, code, serial_number, status, business_id, google_place_id, activated_at, deactivated_at"
      )
      .maybeSingle();

    if (resetQrError) {
      console.error("QR reset update error:", resetQrError);

      return NextResponse.json(
        {
          success: false,
          message: "QR Card gagal di-reset.",
        },
        { status: 500 }
      );
    }

    if (!resetQrCard) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Card sudah berubah atau tidak dapat di-reset.",
        },
        { status: 409 }
      );
    }

    // 8. Tutup riwayat aktivasi sebelumnya.
    const {
      error: historyError,
    } = await admin
      .from("qr_activation_history")
      .update({ deactivated_at: resetAt })
      .eq("qr_card_id", qrCard.id)
      .is("deactivated_at", null);

    if (historyError) {
      console.error("QR reset history error:", historyError);

      // Rollback jika riwayat gagal diperbarui.
      const { error: rollbackError } = await admin
        .from("qr_cards")
        .update({
          status: "active",
          business_id: qrCard.business_id,
          google_place_id: qrCard.google_place_id,
          pin_hash: qrCard.pin_hash,
          activated_at: qrCard.activated_at,
          deactivated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", qrCard.id)
        .eq("status", "empty");

      if (rollbackError) {
        console.error("QR reset rollback error:", rollbackError);
      }

      return NextResponse.json(
        {
          success: false,
          message: "Reset gagal disimpan. Silakan periksa status QR.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QR Card berhasil di-reset.",
      qr_code: resetQrCard.code,
      serial_number: resetQrCard.serial_number,
      status: resetQrCard.status,
      reset_at: resetAt,
    });
  } catch (error) {
    console.error("QR reset unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
