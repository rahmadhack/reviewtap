import { NextResponse } from "next/server";
import crypto from "crypto";

import { createClient } from "@/lib/supabase/server";

const OWNER_USER_ID =
  "6254768d-5805-41e3-8f03-b168081f9102";

const OWNER_ORGANIZATION_ID =
  "2a3a6d01-73ac-4656-b8e7-2c4208593362";

function generateRandomCode(length = 6) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters[crypto.randomInt(characters.length)];
  }

  return result;
}

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export async function POST(request: Request) {
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
    let organizationId: string;
    let resellerUserId: string | null = null;

    // 2. Tentukan organisasi QR.
    if (isOwner) {
      organizationId = OWNER_ORGANIZATION_ID;
    } else {
      // Ambil membership reseller tanpa membatasi nama organisasi.
      // Jika ada lebih dari satu membership reseller, jangan menebak.
      const {
        data: memberships,
        error: membershipError,
      } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "reseller")
        .limit(2);

      if (membershipError) {
        console.error("Reseller membership error:", membershipError);

        return NextResponse.json(
          { error: "Gagal memverifikasi akun reseller." },
          { status: 500 }
        );
      }

      if (!memberships || memberships.length === 0) {
        return NextResponse.json(
          { error: "Akun Anda tidak memiliki izin membuat QR." },
          { status: 403 }
        );
      }

      if (memberships.length !== 1) {
        return NextResponse.json(
          {
            error:
              "Akun Anda memiliki lebih dari satu organisasi reseller. Hubungi Owner untuk memeriksa membership.",
          },
          { status: 409 }
        );
      }

      organizationId = memberships[0].organization_id;
      resellerUserId = user.id;
    }

    // 3. Baca jumlah QR yang akan dibuat.
    let quantity = 1;

    try {
      const body = await request.json();

      if (body?.quantity !== undefined) {
        quantity = Number(body.quantity);
      }
    } catch {
      // Body kosong berarti membuat satu QR.
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      return NextResponse.json(
        {
          error:
            "Jumlah QR harus berupa angka bulat antara 1 sampai 100.",
        },
        { status: 400 }
      );
    }

    // 4. Buat kode unik dalam satu permintaan.
    const generatedCodes = new Set<string>();
    let attempts = 0;
    const maxAttempts = quantity * 100;

    while (
      generatedCodes.size < quantity &&
      attempts < maxAttempts
    ) {
      attempts++;
      generatedCodes.add(generateRandomCode());
    }

    if (generatedCodes.size !== quantity) {
      return NextResponse.json(
        {
          error:
            "Gagal membuat kode QR unik. Silakan coba lagi.",
        },
        { status: 500 }
      );
    }

    const codes = Array.from(generatedCodes);

    // 5. Periksa apakah kode sudah ada di database.
    const {
      data: existingQRs,
      error: existingQRError,
    } = await supabase
      .from("qr_cards")
      .select("code")
      .in("code", codes);

    if (existingQRError) {
      console.error("QR uniqueness check error:", existingQRError);

      return NextResponse.json(
        { error: "Gagal memeriksa kode QR." },
        { status: 500 }
      );
    }

    const existingCodes = new Set(
      (existingQRs ?? []).map((qr) => qr.code)
    );

    if (codes.some((code) => existingCodes.has(code))) {
      return NextResponse.json(
        {
          error:
            "Terjadi bentrok kode QR. Silakan coba buat ulang.",
        },
        { status: 409 }
      );
    }

    // 6. Siapkan QR kosong dengan PIN awal.
    const defaultPinHash = hashPin("0808");

    const qrRows = codes.map((code) => ({
      serial_number: code,
      code,
      status: "empty",
      business_id: null,
      google_place_id: null,
      organization_id: organizationId,
      reseller_user_id: resellerUserId,
      pin_hash: defaultPinHash,
    }));

    // 7. Simpan QR menggunakan sesi pengguna dan kebijakan RLS.
    const {
      data: newQRs,
      error: insertError,
    } = await supabase
      .from("qr_cards")
      .insert(qrRows)
      .select(
        "id, serial_number, code, status, business_id, google_place_id, organization_id, reseller_user_id"
      );

    if (insertError) {
      console.error("Create empty QR insert error:", insertError);

      return NextResponse.json(
        {
          error:
            "QR gagal dibuat. Periksa kebijakan RLS dan membership organisasi.",
        },
        { status: 500 }
      );
    }

    if (!newQRs || newQRs.length !== quantity) {
      console.error("QR count mismatch:", {
        requested: quantity,
        created: newQRs?.length ?? 0,
      });

      return NextResponse.json(
        {
          error:
            "Jumlah QR yang berhasil dibuat tidak sesuai permintaan.",
        },
        { status: 500 }
      );
    }

    // 8. Pertahankan format respons yang digunakan tombol QR.
    return NextResponse.json(
      {
        success: true,
        quantity: newQRs.length,
        qrs: newQRs,
        qr: quantity === 1 ? newQRs[0] : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create empty QR unexpected error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}