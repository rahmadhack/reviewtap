import { NextResponse } from "next/server";
import crypto from "crypto";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const INVITE_EXPIRES_HOURS = 72;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // =========================================================
    // 1. CEK USER LOGIN
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
    // 2. CEK OWNER / ADMIN
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
        "Reseller invite membership error:",
        membershipError
      );

      return NextResponse.json(
        {
          error: "Gagal memeriksa akses.",
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
            "Anda tidak memiliki izin untuk membuat invite reseller.",
        },
        {
          status: 403,
        }
      );
    }

    // =========================================================
    // 3. BUAT TOKEN INVITE
    // =========================================================

    const token = generateToken();
    const tokenHash = hashToken(token);

    const expiresAt = new Date(
      Date.now() +
        INVITE_EXPIRES_HOURS * 60 * 60 * 1000
    ).toISOString();

    // =========================================================
    // 4. SIMPAN INVITE
    // =========================================================

    const admin = createAdminClient();

    const {
      error: insertError,
    } = await admin
      .from("reseller_invites")
      .insert({
        organization_id:
          membership.organization_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: user.id,
      });

    if (insertError) {
      console.error(
        "Create reseller invite error:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Gagal membuat invite reseller.",
        },
        {
          status: 500,
        }
      );
    }

    // =========================================================
    // 5. BUAT LINK
    // =========================================================

    const origin =
      new URL(request.url).origin;

    const inviteUrl =
      `${origin}/auth/sign-up?invite=${token}`;

    return NextResponse.json(
      {
        success: true,
        invite_url: inviteUrl,
        expires_at: expiresAt,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Reseller invite unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      }
    );
  }
}