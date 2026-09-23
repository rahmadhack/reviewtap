import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST() {
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
        "Create empty QR membership error:",
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
            "Anda tidak memiliki izin untuk membuat QR.",
        },
        {
          status: 403,
        }
      );
    }

    // =========================================================
    // 3. AMBIL QR DENGAN NOMOR RT-XXXXXX
    //
    // Contoh:
    // RT-000001
    // RT-000002
    // RT-000003
    //
    // QR TEST seperti RT-TEST-001 tidak ikut dihitung.
    // =========================================================

    const {
      data: existingQRs,
      error: existingQRError,
    } = await supabase
      .from("qr_cards")
      .select("serial_number, code");

    if (existingQRError) {
      console.error(
        "Existing QR lookup error:",
        existingQRError
      );

      return NextResponse.json(
        {
          error: existingQRError.message,
        },
        {
          status: 500,
        }
      );
    }

    let highestNumber = 0;

    for (const qr of existingQRs ?? []) {
      const serial =
        typeof qr.serial_number === "string"
          ? qr.serial_number.trim()
          : "";

      const match =
        /^RT-(\d{6})$/.exec(serial);

      if (!match) {
        continue;
      }

      const number = Number(match[1]);

      if (Number.isFinite(number)) {
        highestNumber = Math.max(
          highestNumber,
          number
        );
      }
    }

    const nextNumber =
      highestNumber + 1;

    const code =
      `RT-${String(nextNumber).padStart(6, "0")}`;

    const serialNumber = code;

    // =========================================================
    // 4. BUAT QR KOSONG
    // =========================================================

    const {
      data: newQR,
      error: insertError,
    } = await supabase
      .from("qr_cards")
      .insert({
        serial_number: serialNumber,
        code,
        status: "empty",
        business_id: null,
        google_place_id: null,
      })
      .select(
        "id, serial_number, code, status, business_id, google_place_id"
      )
      .single();

    if (insertError) {
      console.error(
        "Create empty QR insert error:",
        insertError
      );

      return NextResponse.json(
        {
          error: insertError.message,
        },
        {
          status: 500,
        }
      );
    }

    // =========================================================
    // 5. BERHASIL
    // =========================================================

    return NextResponse.json(
      {
        success: true,
        qr: newQR,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Create empty QR unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error: "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      }
    );
  }
}