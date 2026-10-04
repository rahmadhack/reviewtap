"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Place = {
  place_id: string;
  name: string;
  address: string;
  google_maps_url: string;
};

type Props = {
  code: string;
  serialNumber: string;
};

export default function QRSetupForm({
  code,
  serialNumber,
}: Props) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] =
    useState<Place | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");

  const [loadingPlaces, setLoadingPlaces] =
    useState(false);

  const [activating, setActivating] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showResults, setShowResults] =
    useState(false);

  const requestId = useRef(0);

  /*
   * Google autocomplete
   */
  useEffect(() => {
    const value = query.trim();

    if (
      selectedPlace &&
      value === selectedPlace.name
    ) {
      return;
    }

    if (value.length < 3) {
      setPlaces([]);
      setLoadingPlaces(false);
      return;
    }

    const currentRequestId =
      ++requestId.current;

    const timer = setTimeout(async () => {
      setLoadingPlaces(true);
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
          },
        );

        const data = await response.json();

        if (
          currentRequestId !==
          requestId.current
        ) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Gagal mencari bisnis.",
          );
        }

        setPlaces(data.places || []);
      } catch (err) {
        if (
          currentRequestId !==
          requestId.current
        ) {
          return;
        }

        setPlaces([]);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mencari bisnis.",
        );
      } finally {
        if (
          currentRequestId ===
          requestId.current
        ) {
          setLoadingPlaces(false);
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
    setSuccess("");
  }

  function changePlace() {
    setSelectedPlace(null);
    setQuery("");
    setPlaces([]);
    setShowResults(false);
    setError("");
    setSuccess("");
  }

  function handlePinChange(
    value: string,
    setter: (value: string) => void,
  ) {
    const digits = value
      .replace(/\D/g, "")
      .slice(0, 4);

    setter(digits);
  }

  async function activateQR() {
    setError("");
    setSuccess("");

    if (currentPin.length !== 4) {
      setError(
        "PIN Saat Ini harus terdiri dari 4 digit.",
      );
      return;
    }

    if (!selectedPlace) {
      setError(
        "Silakan pilih bisnis terlebih dahulu.",
      );
      return;
    }

    if (
      newPin.length > 0 &&
      newPin.length !== 4
    ) {
      setError(
        "PIN Baru harus terdiri dari 4 digit.",
      );
      return;
    }

    setActivating(true);

    try {
      const response = await fetch(
        "/api/qr-codes/activate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            current_pin: currentPin,
            google_place_id:
              selectedPlace.place_id,
            google_business_name:
              selectedPlace.name,
            google_business_address:
              selectedPlace.address,
            google_maps_url:
              selectedPlace.google_maps_url,
            new_pin: newPin,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "QR Code gagal diaktifkan.",
        );
      }

      setSuccess(
        "QR Code berhasil diaktifkan.",
      );

      setTimeout(() => {
        router.push(`/q/${code}`);
        router.refresh();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan.",
      );
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* QR INFORMATION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Kartu
        </div>

        <div className="mt-1 text-lg font-bold text-slate-900">
          {serialNumber}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          
        </div>
      </div>

      {/* CURRENT PIN */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-900">
          PIN Saat Ini
        </label>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={currentPin}
          onChange={(event) =>
            handlePinChange(
              event.target.value,
              setCurrentPin,
            )
          }
          placeholder="••••"
          autoComplete="off"
          className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.7em] outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
        />

        <a
          href="https://api.whatsapp.com/send?phone=6285189381883&text=Mau%20Reset%20Pin%20Kartu%20Kak%F0%9F%98%8A"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          Lupa PIN? Hubungi Admin
        </a>
      </div>

      {/* BUSINESS SEARCH */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-900">
          Cari Google Business
        </label>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Ketik nama bisnis untuk mencari bisnis
          Anda di Google.
        </p>

        {!selectedPlace ? (
          <div className="relative mt-3">
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedPlace(null);
                setShowResults(true);
              }}
              onFocus={() => {
                if (
                  query.trim().length >= 3
                ) {
                  setShowResults(true);
                }
              }}
              placeholder="Contoh: Cafe Majuuu"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />

            {loadingPlaces && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              </div>
            )}

            {showResults &&
              query.trim().length >= 3 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {loadingPlaces && (
                    <div className="px-4 py-4 text-sm text-slate-500">
                      Mencari bisnis...
                    </div>
                  )}

                  {!loadingPlaces &&
                    places.map((place) => (
                      <button
                        key={place.place_id}
                        type="button"
                        onClick={() =>
                          selectPlace(place)
                        }
                        className="block w-full border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
                      >
                        <div className="font-semibold text-slate-900">
                          {place.name}
                        </div>

                        <div className="mt-1 text-sm leading-5 text-slate-500">
                          {place.address}
                        </div>
                      </button>
                    ))}

                  {!loadingPlaces &&
                    places.length === 0 &&
                    !error && (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        Tidak ada bisnis ditemukan.
                      </div>
                    )}

                  {!loadingPlaces &&
                    error && (
                      <div className="px-4 py-4 text-sm text-red-600">
                        {error}
                      </div>
                    )}
                </div>
              )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">
                  {selectedPlace.name}
                </div>

                <div className="mt-1 text-sm leading-5 text-slate-500">
                  {selectedPlace.address}
                </div>
              </div>

              <button
                type="button"
                onClick={changePlace}
                className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Ganti
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NEW PIN */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-900">
          PIN Baru
          <span className="ml-1 font-normal text-slate-400">
            (opsional)
          </span>
        </label>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Kosongkan jika ingin tetap menggunakan PIN
          saat ini.
        </p>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={newPin}
          onChange={(event) =>
            handlePinChange(
              event.target.value,
              setNewPin,
            )
          }
          placeholder="••••"
          autoComplete="new-password"
          className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.7em] outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUCCESS */}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* ACTIVATE */}
      <button
        type="button"
        onClick={activateQR}
        disabled={
          activating ||
          currentPin.length !== 4 ||
          !selectedPlace ||
          (newPin.length > 0 &&
            newPin.length !== 4)
        }
        className="w-full rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {activating
          ? "Menyimpan..."
          : "Simpan & Aktifkan"}
      </button>

      <p className="text-center text-xs leading-5 text-slate-400">
        Setelah kartu aktif, scan berikutnya akan
        langsung mengarah ke Google Review bisnis
        yang dipilih.
      </p>
    </div>
  );
}