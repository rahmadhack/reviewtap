
import { NextResponse } from "next/server";
import crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  checkQrPinRateLimit,
  recordQrPinFailure,
  clearQrPinFailures,
} from "@/lib/security/qr-pin-rate-limit";

type ActivateCustomLinkRequest = {
  code?: string;
  current_pin?: string;
  custom_link_url?: string;
  new_pin?: string;
};

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

function validateDestinationUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    let body: ActivateCustomLinkRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Data request tidak valid." },
        { status: 400 }
      );
    }

    const code = String(body.code || "").trim();
    const currentPin = String(body.current_pin || "").trim();
    const destinationUrl = String(body.custom_link_url || "").trim();
    const newPin = String(body.new_pin || "").trim();

    if (!code) {
      return NextResponse.json(
        { success: false, message: "QR Code wajib diisi." },
        { status: 400 }
      );
    }

    const rateLimit = await checkQrPinRateLimit(request, code);

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
              rateLimit.retryAfterSeconds || 900
            ),
          },
        }
      );
    }

    if (!/^\d{4}$/.test(currentPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN Saat Ini harus terdiri dari 4 digit.",
        },
        { status: 400 }
      );
    }

    if (!destinationUrl || !validateDestinationUrl(destinationUrl)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "URL tujuan tidak valid. Gunakan alamat yang diawali http:// atau https://.",
        },
        { status: 400 }
      );
    }

    if (newPin && !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        {
          success: false,
          message: "PIN Baru harus terdiri dari 4 digit.",
        },
        { status: 400 }
      );
    }

    const { data: qrCard, error: qrError } = await supabase
      .from("qr_cards")
      .select(
        "id, code, serial_number, status, business_id, organization_id, pin_hash, destination_type"
      )
      .eq("code", code)
      .maybeSingle();

    if (qrError) {
      console.error("Custom Link QR lookup error:", qrError);

      return NextResponse.json(
        { success: false, message: "Gagal membaca QR Card." },
        { status: 500 }
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        { success: false, message: "QR Code tidak ditemukan." },
        { status: 404 }
      );
    }

    if (qrCard.destination_type !== "custom_link") {
      return NextResponse.json(
        {
          success: false,
          message: "QR ini bukan QR Custom Link.",
        },
        { status: 409 }
      );
    }

    if (qrCard.status !== "empty" || qrCard.business_id !== null) {
      return NextResponse.json(
        {
          success: false,
          message: "QR ini sudah aktif atau tidak dapat diaktifkan.",
        },
        { status: 409 }
      );
    }

    if (!qrCard.organization_id) {
      return NextResponse.json(
        {
          success: false,
          message: "QR belum memiliki organisasi. Hubungi Admin.",
        },
        { status: 422 }
      );
    }

    if (!verifyPin(currentPin, qrCard.pin_hash)) {
      await recordQrPinFailure(request, code);

      return NextResponse.json(
        { success: false, message: "PIN salah." },
        { status: 403 }
      );
    }

    await clearQrPinFailures(request, code);

    const activatedAt = new Date().toISOString();
    const pinHash = newPin ? hashPin(newPin) : qrCard.pin_hash;

    const { data: updatedQr, error: updateError } = await supabase
      .from("qr_cards")
      .update({
        status: "active",
        custom_link_url: destinationUrl,
        pin_hash: pinHash,
        activated_at: activatedAt,
        deactivated_at: null,
        updated_at: activatedAt,
      })
      .eq("id", qrCard.id)
      .eq("status", "empty")
      .eq("destination_type", "custom_link")
      .select("id, code, serial_number, status, custom_link_url, activated_at")
      .maybeSingle();

    if (updateError) {
      console.error("Custom Link activation update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Aktivasi gagal disimpan. Periksa kebijakan akses database.",
        },
        { status: 500 }
      );
    }

    if (!updatedQr) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR sudah berubah atau tidak dapat diaktifkan. Muat ulang halaman.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "QR Custom Link berhasil diaktifkan.",
      qr_code: updatedQr.code,
      serial_number: updatedQr.serial_number,
      custom_link_url: updatedQr.custom_link_url,
      activated_at: updatedQr.activated_at,
      pin_changed: Boolean(newPin),
    });
  } catch (error) {
    console.error("Custom Link activation unexpected error:", error);

    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
