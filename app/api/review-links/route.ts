import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function generateCode(length = 8) {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Belum login" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const businessId = String(body.business_id || "");
    const name = String(body.name || "").trim();

    if (!businessId || !name) {
      return NextResponse.json(
        {
          error: "Business ID dan nama QR wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Cari organization user
    const { data: membership, error: membershipError } =
      await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          error: "Anda tidak memiliki akses.",
        },
        { status: 403 }
      );
    }

    // Pastikan business milik organization user
    const { data: business, error: businessError } =
      await supabase
        .from("businesses")
        .select("id, name, google_review_url")
        .eq("id", businessId)
        .eq("organization_id", membership.organization_id)
        .single();

    if (businessError || !business) {
      return NextResponse.json(
        {
          error: "Bisnis tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    if (!business.google_review_url) {
      return NextResponse.json(
        {
          error:
            "Google Review URL belum diatur untuk bisnis ini.",
        },
        { status: 400 }
      );
    }

    const code = generateCode();

    const { data: reviewLink, error: insertError } =
      await supabase
        .from("review_links")
        .insert({
          business_id: business.id,
          name,
          code,
          destination_url: business.google_review_url,
          is_active: true,
        })
        .select()
        .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reviewLink,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan server.",
      },
      { status: 500 }
    );
  }
}