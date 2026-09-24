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
    // 3. BUAT KODE RANDOM
    //
    // Contoh:
    // W2F9L7
    // K8M3QX
    // 7P4NZW
    //
    // Karakter yang mudah tertukar seperti:
    // 0, O, 1, I
    // sengaja tidak digunakan.
    // =========================================================

    let code = "";
    let isUnique = false;

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateRandomCode(6);

      const {
        data: existingQR,
        error: existingQRError,
      } = await supabase
        .from("qr_cards")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();

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

      if (!existingQR) {
        code = candidate;
        isUnique = true;
        break;
      }
    }

    if (!isUnique) {
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