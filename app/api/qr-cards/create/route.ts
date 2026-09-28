import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function generateRandomCode(length = 6) {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(
      Math.random() * characters.length
    );

    result += characters[randomIndex];
  }

  return result;
}

export async function POST(request: Request) {
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
    // 3. BACA JUMLAH QR
    //
    // Tanpa quantity = 1 QR
    // quantity 10 = 10 QR
    //
    // Maksimal 100 QR sekali proses.
    // =========================================================

    let quantity = 1;

    try {
      const body = await request.json();

      if (body?.quantity !== undefined) {
        quantity = Number(body.quantity);
      }
    } catch {
      // Body kosong tetap dianggap membuat 1 QR.
      quantity = 1;
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
        {
          status: 400,
        }
      );
    }

    // =========================================================
    // 4. BUAT KODE RANDOM YANG UNIK
    //
    // Contoh:
    // W2F9L7
    // K8M3QX
    // 7P4NZW
    //
    // Karakter yang mudah tertukar:
    // 0, O, 1, I
    // tidak digunakan.
    // =========================================================

    const generatedCodes = new Set<string>();

    let attempts = 0;
    const maxAttempts = quantity * 20;

    while (
      generatedCodes.size < quantity &&
      attempts < maxAttempts
    ) {
      attempts++;

      generatedCodes.add(
        generateRandomCode(6)
      );
    }

    if (generatedCodes.size !== quantity) {
      return NextResponse.json(
        {
          error:
            "Gagal membuat kode QR unik. Silakan coba lagi.",
        },
        {
          status: 500,
        }
      );
    }

    let codes = Array.from(generatedCodes);

    // =========================================================
    // 5. CEK KODE YANG SUDAH ADA DI DATABASE
    // =========================================================

    for (let attempt = 0; attempt < 10; attempt++) {
      const {
        data: existingQRs,
        error: existingQRError,
      } = await supabase
        .from("qr_cards")
        .select("code")
        .in("code", codes);

      if (existingQRError) {
        console.error(
          "QR code uniqueness check error:",
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

      const existingCodes = new Set(
        (existingQRs ?? []).map(
          (qr) => qr.code
        )
      );

      if (existingCodes.size === 0) {
        break;
      }

      // Buat ulang kode yang bentrok.
      const availableCodes = codes.filter(
        (code) => !existingCodes.has(code)
      );

      while (
        availableCodes.length < quantity
      ) {
        const newCode =
          generateRandomCode(6);

        if (
          !existingCodes.has(newCode) &&
          !availableCodes.includes(newCode)
        ) {
          availableCodes.push(newCode);
        }
      }

      codes = availableCodes;
    }

    // =========================================================
    // 6. SIAPKAN DATA QR
    // =========================================================

    const qrRows = codes.map((code) => ({
      serial_number: code,
      code,
      status: "empty",
      business_id: null,
      google_place_id: null,
    }));

    // =========================================================
    // 7. INSERT SEMUA QR SEKALIGUS
    // =========================================================

    const {
      data: newQRs,
      error: insertError,
    } = await supabase
      .from("qr_cards")
      .insert(qrRows)
      .select(
        "id, serial_number, code, status, business_id, google_place_id"
      );

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

    if (!newQRs || newQRs.length !== quantity) {
      console.error(
        "Create empty QR count mismatch:",
        {
          requested: quantity,
          created: newQRs?.length ?? 0,
        }
      );

      return NextResponse.json(
        {
          error:
            "Jumlah QR yang berhasil dibuat tidak sesuai dengan permintaan.",
        },
        {
          status: 500,
        }
      );
    }

    // =========================================================
    // 8. BERHASIL
    // =========================================================

    return NextResponse.json(
      {
        success: true,
        quantity: newQRs.length,
        qrs: newQRs,

        // Tetap sediakan "qr" agar kompatibel
        // dengan tombol lama yang membuat 1 QR.
        qr:
          quantity === 1
            ? newQRs[0]
            : undefined,
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