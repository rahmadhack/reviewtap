import { NextResponse } from "next/server";

const GOOGLE_PLACES_API_URL =
  "https://places.googleapis.com/v1/places:searchText";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GOOGLE_PLACES_API_KEY belum dikonfigurasi.",
        },
        { status: 500 }
      );
    }

    let body: { query?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Data pencarian tidak valid." },
        { status: 400 }
      );
    }

    const query = String(body.query || "").trim();

    if (!query) {
      return NextResponse.json({
        success: true,
        places: [],
      });
    }

    const response = await fetch(GOOGLE_PLACES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "id",
        regionCode: "ID",
        maxResultCount: 5,
      }),
      cache: "no-store",
    });

    const responseText = await response.text();

    let data: any = {};

    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error(
          "Google Places returned invalid JSON. HTTP status:",
          response.status
        );

        return NextResponse.json(
          { error: "Respons pencarian Google tidak valid. Silakan coba lagi." },
          { status: 502 }
        );
      }
    }

    if (!response.ok) {
      console.error("Google Places API error:", {
        status: response.status,
        error: data?.error,
      });

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Pencarian Google gagal (HTTP ${response.status}).`,
        },
        { status: 502 }
      );
    }

    const places = Array.isArray(data.places)
      ? data.places
          .filter((place: any) => place.id && place.displayName?.text)
          .map((place: any) => ({
            place_id: place.id,
            name: place.displayName.text,
            address: place.formattedAddress || "",
            google_maps_url: place.googleMapsUri || "",
          }))
      : [];

    return NextResponse.json({
      success: true,
      places,
    });
  } catch (error) {
    console.error("Google Places search error:", error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan saat mencari bisnis. Silakan coba lagi.",
      },
      { status: 500 }
    );
  }
}