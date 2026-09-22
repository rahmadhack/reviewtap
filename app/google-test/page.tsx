"use client";

import { useEffect, useRef, useState } from "react";

type Place = {
  place_id: string;
  name: string;
  address: string;
  google_maps_url: string;
};

export default function GoogleTestPage() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] =
    useState<Place | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const requestId = useRef(0);

  useEffect(() => {
    const value = query.trim();

    if (selectedPlace && value === selectedPlace.name) {
      return;
    }

    if (value.length < 3) {
      setPlaces([]);
      setLoading(false);
      setError("");
      return;
    }

    const currentRequestId = ++requestId.current;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      setShowResults(true);

      try {
        const response = await fetch(
          "/api/google/places/search",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: value,
            }),
          }
        );

        const data = await response.json();

        if (currentRequestId !== requestId.current) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error || "Gagal mencari bisnis."
          );
        }

        setPlaces(data.places || []);
      } catch (err) {
        if (currentRequestId !== requestId.current) {
          return;
        }

        setPlaces([]);

        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan."
        );
      } finally {
        if (currentRequestId === requestId.current) {
          setLoading(false);
        }
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query, selectedPlace]);

  function selectPlace(place: Place) {
    setSelectedPlace(place);
    setQuery(place.name);
    setPlaces([]);
    setShowResults(false);
    setError("");
  }

  function clearSelection() {
    setSelectedPlace(null);
    setQuery("");
    setPlaces([]);
    setShowResults(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Cari Bisnis
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Ketik nama bisnis dan pilih dari rekomendasi
            Google.
          </p>

          <div className="relative mt-6">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedPlace(null);
                  setShowResults(true);
                }}
                onFocus={() => {
                  if (query.trim().length >= 3) {
                    setShowResults(true);
                  }
                }}
                placeholder="Contoh: Cafe Majuuu"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />

              {loading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                </div>
              )}
            </div>

            {showResults &&
              query.trim().length >= 3 &&
              (loading ||
                places.length > 0 ||
                error) && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {loading && (
                    <div className="px-4 py-4 text-sm text-slate-500">
                      Mencari bisnis...
                    </div>
                  )}

                  {!loading &&
                    error && (
                      <div className="px-4 py-4 text-sm text-red-600">
                        {error}
                      </div>
                    )}

                  {!loading &&
                    !error &&
                    places.map((place) => (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() =>
                          selectPlace(place)
                        }
                        className="block w-full border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
                      >
                        <div className="font-medium text-slate-900">
                          {place.name}
                        </div>

                        <div className="mt-1 text-sm leading-5 text-slate-500">
                          {place.address}
                        </div>
                      </button>
                    ))}

                  {!loading &&
                    !error &&
                    places.length === 0 && (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        Tidak ada bisnis ditemukan.
                      </div>
                    )}
                </div>
              )}
          </div>

          {selectedPlace && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Bisnis terpilih
                  </div>

                  <div className="mt-1 font-semibold text-slate-900">
                    {selectedPlace.name}
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    {selectedPlace.address}
                  </div>

                  <div className="mt-3 break-all text-xs text-slate-400">
                    Place ID: {selectedPlace.place_id}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Ganti
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}