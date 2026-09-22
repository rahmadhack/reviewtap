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

    const body = await request.json();

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

    const data = await response.json();

    if (!response.ok) {
      console.error("Google Places API error:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Gagal mencari bisnis di Google.",
        },
        { status: response.status }
      );
    }

    const places = Array.isArray(data.places)
      ? data.places.map((place: any) => ({
          place_id: place.id || "",
          name: place.displayName?.text || "",
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
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mencari bisnis.",
      },
      { status: 500 }
    );
  }
}