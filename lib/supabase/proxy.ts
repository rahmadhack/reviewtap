import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OWNER_USER_ID = "6254768d-5805-41e3-8f03-b168081f9102";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Rute yang dapat diakses tanpa login.
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/q/") ||
    pathname === "/api/reseller-sign-up" ||
    pathname === "/api/google/places/search" ||
    pathname.startsWith("/setup/")
  ) {
    return supabaseResponse;
  }

  // Selain rute publik, pengguna wajib login.
  if (authError || !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", pathname);

    return NextResponse.redirect(url);
  }

  // Hanya Owner resmi yang dapat membuka /protected.
  const isProtectedRoute =
    pathname === "/protected" ||
    pathname.startsWith("/protected/");

  if (isProtectedRoute && user.id !== OWNER_USER_ID) {
    const url = request.nextUrl.clone();
    url.pathname = "/kelola-kartu";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}