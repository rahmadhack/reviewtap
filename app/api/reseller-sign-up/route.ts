import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createPublicSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL belum tersedia."
    );
  }

  if (!publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum tersedia."
    );
  }

  return createClient(
    supabaseUrl,
    publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const inviteToken =
      typeof body.invite === "string"
        ? body.invite.trim()
        : "";

    if (!name || !email || !password || !inviteToken) {
      return NextResponse.json(
        {
          error:
            "Nama, email, password, dan invite wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Password minimal 6 karakter.",
        },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(inviteToken);

    const admin = createAdminClient();

    // =====================================================
    // 1. CARI INVITE
    // =====================================================

    const {
      data: invite,
      error: inviteError,
    } = await admin
      .from("reseller_invites")
      .select(
        "id, organization_id, expires_at, used_at"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteError) {
      console.error(
        "Reseller invite lookup error:",
        inviteError
      );

      return NextResponse.json(
        {
          error:
            "Gagal memeriksa invite.",
        },
        { status: 500 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        {
          error:
            "Invite reseller tidak valid.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 2. CEK SUDAH DIGUNAKAN
    // =====================================================

    if (invite.used_at) {
      return NextResponse.json(
        {
          error:
            "Invite reseller sudah digunakan.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 3. CEK EXPIRED
    // =====================================================

    if (
      new Date(invite.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        {
          error:
            "Invite reseller sudah expired.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 4. RESERVE INVITE
    //
    // Hanya satu request yang boleh memakai invite.
    // =====================================================

    const {
      data: reservedInvite,
      error: reserveError,
    } = await admin
      .from("reseller_invites")
      .update({
        used_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();

    if (reserveError) {
      console.error(
        "Reserve reseller invite error:",
        reserveError
      );

      return NextResponse.json(
        {
          error:
            "Gagal menggunakan invite.",
        },
        { status: 500 }
      );
    }

    if (!reservedInvite) {
      return NextResponse.json(
        {
          error:
            "Invite reseller sudah digunakan.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 5. BUAT USER SUPABASE
    //
    // Gunakan signUp() agar Supabase mengirim
    // email konfirmasi kepada reseller.
    // =====================================================

    const supabase = createPublicSupabaseClient();

    const origin =
      new URL(request.url).origin;

    const {
      data: signUpData,
      error: signUpError,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo:
          `${origin}/auth/confirm`,
      },
    });

    if (signUpError || !signUpData.user) {
      console.error(
        "Create reseller user error:",
        signUpError
      );

      // Kembalikan invite supaya bisa dipakai lagi
      await admin
        .from("reseller_invites")
        .update({
          used_at: null,
        })
        .eq("id", invite.id);

      return NextResponse.json(
        {
          error:
            signUpError?.message ||
            "Gagal membuat akun reseller.",
        },
        { status: 400 }
      );
    }

    const userId = signUpData.user.id;

    // =====================================================
    // 6. MASUKKAN KE ORGANIZATION
    // =====================================================

    const {
      error: membershipError,
    } = await admin
      .from("organization_members")
      .insert({
        organization_id:
          invite.organization_id,
        user_id: userId,
        role: "reseller",
      });

    if (membershipError) {
      console.error(
        "Create reseller membership error:",
        membershipError
      );

      // Hapus user jika membership gagal
      await admin.auth.admin.deleteUser(
        userId
      );

      // Kembalikan invite
      await admin
        .from("reseller_invites")
        .update({
          used_at: null,
        })
        .eq("id", invite.id);

      return NextResponse.json(
        {
          error:
            "Gagal menghubungkan akun reseller ke organisasi.",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // 7. SELESAI
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        message:
          "Registrasi reseller berhasil. Silakan cek email untuk konfirmasi akun.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Reseller signup unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}