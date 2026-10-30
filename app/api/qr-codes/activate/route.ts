import { NextResponse } from "next/server";
import crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  checkQrPinRateLimit,
  recordQrPinFailure,
  clearQrPinFailures,
} from "@/lib/security/qr-pin-rate-limit";

type ActivateRequest = {
  code?: string;
  current_pin?: string;

  google_place_id?: string;
  google_business_name?: string;
  google_business_address?: string;
  google_maps_url?: string;

  google_maps_link?: string;

  new_pin?: string;
};

type ResolvedGooglePlace = {
  placeId: string;
  name: string;
  address: string;
  mapsUrl: string;
};

const GOOGLE_MAPS_HOSTS = [
  "share.google",
  "google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
];

function isAllowedGoogleMapsHost(hostname: string) {
  const host = hostname.toLowerCase();

  return GOOGLE_MAPS_HOSTS.some(
    (allowedHost) =>
      host === allowedHost ||
      host.endsWith(`.${allowedHost}`),
  );
}

// =========================================================
// PIN
// =========================================================

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(pin, salt, 64)
    .toString("hex");

  return `scrypt:${salt}:${hash}`;
}

function verifyPin(
  pin: string,
  storedHash: string | null,
) {
  if (!storedHash) return false;

  const parts = storedHash.split(":");

  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = parts[1];
  const expectedHash = parts[2];

  try {
    const actualHash = crypto
      .scryptSync(pin, salt, 64)
      .toString("hex");

    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    );
  } catch {
    return false;
  }
}

// =========================================================
// GOOGLE REVIEW URL
// =========================================================

function createGoogleReviewUrl(googlePlaceId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
    googlePlaceId,
  )}`;
}

// =========================================================
// BUSINESS SLUG
// =========================================================

function createBusinessSlug(
  name: string,
  googlePlaceId: string,
) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  const placeSuffix = googlePlaceId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(-8);

  return `${baseSlug}-${placeSuffix}`;
}

// =========================================================
// GOOGLE MAPS URL HELPERS
// =========================================================

function extractGooglePlaceId(value: string) {
  const patterns = [
    /[?&](?:query_place_id|place_id|placeid)=(ChIJ[a-zA-Z0-9_-]+)/i,
    /!1s(ChIJ[a-zA-Z0-9_-]+)/i,
    /(ChIJ[a-zA-Z0-9_-]{10,})/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractBusinessNameFromMapsUrl(value: string) {
  try {
    const url = new URL(value);

    const placeMatch = url.pathname.match(
      /\/maps\/place\/([^/]+)/i,
    );

    let name = placeMatch?.[1] || "";

    if (!name) {
      name =
        url.searchParams.get("q") ||
        url.searchParams.get("query") ||
        url.searchParams.get("destination") ||
        "";
    }

    if (!name) return null;

    name = decodeURIComponent(
      name.replace(/\+/g, " "),
    )
      .split(",")[0]
      .replace(/\s+/g, " ")
      .trim();

    return name || null;
  } catch {
    return null;
  }
}

function normalizeBusinessName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// =========================================================
// RESOLVE GOOGLE MAPS LINK
// =========================================================

async function resolveGoogleMapsLink(
  value: string,
): Promise<ResolvedGooglePlace> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY belum dikonfigurasi.",
    );
  }

  let currentUrl: URL;

  try {
    currentUrl = new URL(value);
  } catch {
    throw new Error("Link Google Maps tidak valid.");
  }

  if (
    currentUrl.protocol !== "https:" &&
    currentUrl.protocol !== "http:"
  ) {
    throw new Error(
      "Link Google Maps harus menggunakan http:// atau https://.",
    );
  }

  if (
    currentUrl.username ||
    currentUrl.password ||
    !isAllowedGoogleMapsHost(currentUrl.hostname)
  ) {
    throw new Error(
      "Gunakan link Google Maps atau share.google yang valid.",
    );
  }

  /*
   * Ikuti pengalihan link pendek Google.
   * Pengalihan dibatasi dan setiap tujuan diperiksa domainnya.
   */
  let redirectResolved = false;

  for (let i = 0; i < 6; i++) {
    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error(
          "Link Google Maps tidak dapat diarahkan.",
        );
      }

      const nextUrl = new URL(location, currentUrl);

      if (
        (nextUrl.protocol !== "https:" &&
          nextUrl.protocol !== "http:") ||
        nextUrl.username ||
        nextUrl.password ||
        !isAllowedGoogleMapsHost(nextUrl.hostname)
      ) {
        throw new Error(
          "Pengalihan link bukan menuju Google Maps.",
        );
      }

      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      throw new Error(
        "Gagal membuka link Google Maps.",
      );
    }

    /*
     * Pada respons non-redirect, gunakan URL akhir
     * yang dilaporkan oleh fetch jika tersedia.
     */
    if (response.url) {
      const finalUrl = new URL(response.url);

      if (
        (finalUrl.protocol !== "https:" &&
          finalUrl.protocol !== "http:") ||
        !isAllowedGoogleMapsHost(finalUrl.hostname)
      ) {
        throw new Error(
          "Link tidak berakhir pada halaman Google Maps.",
        );
      }

      currentUrl = finalUrl;
    }

    redirectResolved = true;
    break;
  }

  if (!redirectResolved) {
    throw new Error(
      "Tautan Google Maps memiliki terlalu banyak pengalihan.",
    );
  }

  // =======================================================
  // 1. Coba ambil Place ID dari URL
  // =======================================================

  let placeId = extractGooglePlaceId(
    currentUrl.toString(),
  );

  if (!placeId) {
    placeId = extractGooglePlaceId(value);
  }

  // =======================================================
  // 2. Jika Place ID tidak ada, cari berdasarkan nama
  // =======================================================

  if (!placeId) {
    const businessQuery = extractBusinessNameFromMapsUrl(
      currentUrl.toString(),
    );

    if (!businessQuery) {
      throw new Error(
        "Nama bisnis tidak dapat dibaca dari link Google Maps. Silakan gunakan pencarian Google Business.",
      );
    }

    const searchResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery: businessQuery,
          maxResultCount: 5,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );

    const searchText = await searchResponse.text();

    let searchData: {
      places?: Array<{
        id?: string;
        displayName?: {
          text?: string;
        };
        formattedAddress?: string;
        googleMapsUri?: string;
      }>;
      error?: {
        message?: string;
      };
    } = {};

    try {
      searchData = JSON.parse(searchText);
    } catch {
      throw new Error(
        "Respons pencarian Google Places tidak dapat dibaca.",
      );
    }

    if (!searchResponse.ok) {
      throw new Error(
        searchData.error?.message ||
          "Gagal mencari bisnis melalui Google Places.",
      );
    }

    const expectedName = normalizeBusinessName(
      businessQuery,
    );

    const matchingPlaces = (
      searchData.places || []
    ).filter((place) => {
      const resultName = normalizeBusinessName(
        place.displayName?.text || "",
      );

      return (
        Boolean(place.id) &&
        Boolean(resultName) &&
        resultName === expectedName
      );
    });

    if (matchingPlaces.length !== 1) {
      throw new Error(
        "Bisnis dari link Google Maps tidak dapat dicocokkan secara pasti. Silakan gunakan pencarian Google Business.",
      );
    }

    placeId = matchingPlaces[0].id!;
  }

  // =======================================================
  // 3. Ambil detail bisnis berdasarkan Place ID
  // =======================================================

  const detailsResponse = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(
      placeId,
    )}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,googleMapsUri",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  );

  const detailsText = await detailsResponse.text();

  let details: {
    id?: string;
    displayName?: {
      text?: string;
    };
    formattedAddress?: string;
    googleMapsUri?: string;
    error?: {
      message?: string;
    };
  } = {};

  try {
    details = JSON.parse(detailsText);
  } catch {
    throw new Error(
      "Data bisnis dari Google tidak dapat dibaca.",
    );
  }

  if (!detailsResponse.ok || !details.id) {
    throw new Error(
      details.error?.message ||
        "Bisnis tidak ditemukan di Google Places.",
    );
  }

  const name = String(
    details.displayName?.text || "",
  ).trim();

  if (!name) {
    throw new Error(
      "Nama bisnis tidak ditemukan dari Google Places.",
    );
  }

  return {
    placeId: details.id,
    name,
    address: details.formattedAddress || "",
    mapsUrl:
      details.googleMapsUri || currentUrl.toString(),
  };
}

// =========================================================
// POST: ACTIVATE QR CARD
// =========================================================

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    let body: ActivateRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Data request tidak valid.",
        },
        { status: 400 },
      );
    }

    const code = String(body.code || "").trim();
    const currentPin = String(
      body.current_pin || "",
    ).trim();

    const googlePlaceId = String(
      body.google_place_id || "",
    ).trim();

    const googleBusinessName = String(
      body.google_business_name || "",
    ).trim();

    const googleBusinessAddress = String(
      body.google_business_address || "",
    ).trim();

    const googleMapsUrl = String(
      body.google_maps_url || "",
    ).trim();

    const googleMapsLink = String(
      body.google_maps_link || "",
    ).trim();

    const newPin = String(
      body.new_pin || "",
    ).trim();

    // =====================================================
    // 1. Validasi input
    // =====================================================

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code wajib diisi.",
        },
        { status: 400 },
      );
    }

    // =====================================================
    // 2. Rate limit PIN
    // =====================================================

    const rateLimit = await checkQrPinRateLimit(
      request,
      code,
    );

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
              rateLimit.retryAfterSeconds || 900,
            ),
          },
        },
      );
    }

    if (!/^\d{4}$/.test(currentPin)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PIN Saat Ini harus terdiri dari 4 digit.",
        },
        { status: 400 },
      );
    }

    const hasSelectedBusiness =
      Boolean(googlePlaceId) &&
      Boolean(googleBusinessName);

    if (!hasSelectedBusiness && !googleMapsLink) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Pilih bisnis Google atau masukkan link Google Maps.",
        },
        { status: 400 },
      );
    }

    if (newPin && !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PIN Baru harus terdiri dari 4 digit.",
        },
        { status: 400 },
      );
    }

    // =====================================================
    // 3. Cari QR Card
    // =====================================================

    const { data: qrCard, error: qrCardError } =
      await supabase
        .from("qr_cards")
        .select(
          `
            id,
            code,
            serial_number,
            status,
            business_id,
            organization_id,
            pin_hash,
            activated_at
          `,
        )
        .eq("code", code)
        .maybeSingle();

    if (qrCardError) {
      console.error(
        "QR card lookup error:",
        qrCardError,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Gagal membaca QR Card.",
        },
        { status: 500 },
      );
    }

    if (!qrCard) {
      return NextResponse.json(
        {
          success: false,
          message: "QR Code tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    // =====================================================
    // 4. Pastikan QR masih kosong
    // =====================================================

    if (qrCard.status !== "empty") {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini sudah aktif atau tidak dapat diaktifkan.",
        },
        { status: 409 },
      );
    }

    if (qrCard.business_id !== null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini sudah terhubung dengan bisnis.",
        },
        { status: 409 },
      );
    }

    if (!qrCard.organization_id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card ini belum memiliki organisasi. Silakan hubungi Admin.",
        },
        { status: 422 },
      );
    }

    // =====================================================
    // 5. Verifikasi PIN Saat Ini
    // =====================================================

    const pinIsValid = verifyPin(
      currentPin,
      qrCard.pin_hash,
    );

    if (!pinIsValid) {
      await recordQrPinFailure(request, code);

      return NextResponse.json(
        {
          success: false,
          message: "PIN salah.",
        },
        { status: 403 },
      );
    }

    await clearQrPinFailures(request, code);

    // =====================================================
    // 6. Tentukan identitas bisnis
    // =====================================================

    let resolvedPlaceId = googlePlaceId;
    let resolvedBusinessName = googleBusinessName;

    /*
     * Jika pengguna memilih hasil pencarian,
     * pilihan tersebut digunakan sebagai prioritas.
     *
     * Jika tidak memilih hasil pencarian,
     * proses link Google Maps.
     */

    if (!hasSelectedBusiness && googleMapsLink) {
      try {
        const resolved = await resolveGoogleMapsLink(
          googleMapsLink,
        );

        resolvedPlaceId = resolved.placeId;
        resolvedBusinessName = resolved.name;
      } catch (error) {
        console.error(
          "Google Maps link resolution error:",
          error,
        );

        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Gagal memproses link Google Maps.",
          },
          { status: 422 },
        );
      }
    }

    if (!resolvedPlaceId || !resolvedBusinessName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Identitas bisnis tidak berhasil ditemukan. Silakan gunakan pencarian Google Business.",
        },
        { status: 422 },
      );
    }

    // =====================================================
    // 7. Buat Google Review URL
    // =====================================================

    const googleReviewUrl =
      createGoogleReviewUrl(resolvedPlaceId);

    // =====================================================
    // 8. Cari business yang sudah menggunakan Google Place ID
    // =====================================================

    const {
      data: existingBusiness,
      error: existingBusinessError,
    } = await supabase
      .from("businesses")
      .select(
        `
          id,
          name,
          google_place_id,
          google_review_url
        `,
      )
      .eq(
        "organization_id",
        qrCard.organization_id,
      )
      .eq("google_place_id", resolvedPlaceId)
      .maybeSingle();

    if (existingBusinessError) {
      console.error(
        "Business lookup error:",
        existingBusinessError,
      );

      return NextResponse.json(
        {
          success: false,
          message: "Gagal memeriksa data bisnis.",
        },
        { status: 500 },
      );
    }

    // =====================================================
    // 9. Gunakan business lama atau buat business baru
    // =====================================================

    let businessId: string;
    let businessName: string;

    if (existingBusiness) {
      const {
        data: updatedBusiness,
        error: businessUpdateError,
      } = await supabase
        .from("businesses")
        .update({
          name: resolvedBusinessName,
          google_place_id: resolvedPlaceId,
          google_review_url: googleReviewUrl,
        })
        .eq("id", existingBusiness.id)
        .select(
          `
            id,
            name,
            google_place_id,
            google_review_url
          `,
        )
        .single();

      if (
        businessUpdateError ||
        !updatedBusiness
      ) {
        console.error(
          "Business update error:",
          businessUpdateError,
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Gagal memperbarui data bisnis.",
          },
          { status: 500 },
        );
      }

      businessId = updatedBusiness.id;
      businessName = updatedBusiness.name;
    } else {
      const businessSlug = createBusinessSlug(
        resolvedBusinessName,
        resolvedPlaceId,
      );

      const {
        data: createdBusiness,
        error: businessCreateError,
      } = await supabase
        .from("businesses")
        .insert({
          organization_id:
            qrCard.organization_id,
          name: resolvedBusinessName,
          slug: businessSlug,
          google_place_id: resolvedPlaceId,
          google_review_url: googleReviewUrl,
        })
        .select(
          `
            id,
            name,
            google_place_id,
            google_review_url
          `,
        )
        .single();

      if (
        businessCreateError ||
        !createdBusiness
      ) {
        console.error(
          "Business create error:",
          businessCreateError,
        );

        return NextResponse.json(
          {
            success: false,
            message: "Bisnis gagal dibuat.",
          },
          { status: 500 },
        );
      }

      businessId = createdBusiness.id;
      businessName = createdBusiness.name;
    }

    // =====================================================
    // 10. Tentukan PIN baru
    // =====================================================

    const pinHash = newPin
      ? hashPin(newPin)
      : qrCard.pin_hash;

    // =====================================================
    // 11. Aktifkan QR Card
    // =====================================================

    const activatedAt = new Date().toISOString();

    const {
      data: updatedQrCard,
      error: qrUpdateError,
    } = await supabase
      .from("qr_cards")
      .update({
        status: "active",
        business_id: businessId,
        google_place_id: resolvedPlaceId,
        pin_hash: pinHash,
        activated_at: activatedAt,
        deactivated_at: null,
        updated_at: activatedAt,
      })
      .eq("id", qrCard.id)
      .eq("status", "empty")
      .select(
        `
          id,
          code,
          serial_number,
          status,
          business_id,
          google_place_id,
          activated_at
        `,
      )
      .maybeSingle();

    if (qrUpdateError) {
      console.error(
        "QR card update error:",
        qrUpdateError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card gagal diaktifkan.",
        },
        { status: 500 },
      );
    }

    if (!updatedQrCard) {
      return NextResponse.json(
        {
          success: false,
          message:
            "QR Card sudah berubah atau tidak dapat diaktifkan.",
        },
        { status: 409 },
      );
    }

    // =====================================================
    // 12. Simpan activation history
    // =====================================================

    const { error: historyError } = await supabase
      .from("qr_activation_history")
      .insert({
        qr_card_id: qrCard.id,
        business_id: businessId,
        google_review_url: googleReviewUrl,
        activated_at: activatedAt,
        deactivated_at: null,
        activated_by: null,
      });

    if (historyError) {
      console.error(
        "QR activation history error:",
        historyError,
      );

      // Rollback status QR jika history gagal
      await supabase
        .from("qr_cards")
        .update({
          status: "empty",
          business_id: null,
          google_place_id: null,
          activated_at: null,
          deactivated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", qrCard.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "Aktivasi QR gagal disimpan. Silakan coba lagi.",
        },
        { status: 500 },
      );
    }

    // =====================================================
    // 13. Berhasil
    // =====================================================

    return NextResponse.json({
      success: true,
      message: "QR Card berhasil diaktifkan.",
      qr_code: updatedQrCard.code,
      serial_number: updatedQrCard.serial_number,
      business_id: businessId,
      business_name: businessName,
      google_place_id: resolvedPlaceId,
      google_review_url: googleReviewUrl,
      activated_at: activatedAt,
      pin_changed: Boolean(newPin),
    });
  } catch (error) {
    console.error(
      "QR activation unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
}