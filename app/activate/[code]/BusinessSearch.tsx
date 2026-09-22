"use client";

import { useMemo, useState } from "react";

export type Business = {
  id: string;
  name: string;
  address: string | null;
  google_review_url?: string | null;
};

type BusinessSearchProps = {
  businesses: Business[];
  code: string;
  onSelect?: (business: Business | null) => void;
};

export default function BusinessSearch({
  businesses,
  code,
  onSelect,
}: BusinessSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] =
    useState<Business | null>(null);

  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [activationSuccess, setActivationSuccess] = useState(false);

  /*
   * Filter bisnis berdasarkan nama atau alamat.
   */
  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return [];
    }

    return businesses
      .filter((business) => {
        const name = business.name?.toLowerCase() ?? "";
        const address = business.address?.toLowerCase() ?? "";

        return name.includes(keyword) || address.includes(keyword);
      })
      .slice(0, 8);
  }, [businesses, query]);

  /*
   * Pilih bisnis.
   */
  function handleSelect(business: Business) {
    setSelectedBusiness(business);
    setQuery(business.name);

    setActivationError("");
    setActivationSuccess(false);

    onSelect?.(business);
  }

  /*
   * Hapus pilihan bisnis.
   */
  function handleClear() {
    setQuery("");
    setSelectedBusiness(null);

    setActivationError("");
    setActivationSuccess(false);

    onSelect?.(null);
  }

  /*
   * Aktivasi QR.
   */
  async function handleActivate() {
    if (!selectedBusiness) {
      setActivationError("Silakan pilih bisnis terlebih dahulu.");
      return;
    }

    if (!selectedBusiness.google_review_url) {
      setActivationError(
        "Bisnis ini belum memiliki Google Review URL. Silakan tambahkan Google Review URL terlebih dahulu."
      );
      return;
    }

    setIsActivating(true);
    setActivationError("");
    setActivationSuccess(false);

    try {
      const response = await fetch("/api/qr-cards/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          business_id: selectedBusiness.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "QR gagal diaktifkan. Silakan coba lagi."
        );
      }

      setActivationSuccess(true);
    } catch (error) {
      console.error("Activation error:", error);

      setActivationError(
        error instanceof Error
          ? error.message
          : "QR gagal diaktifkan. Silakan coba lagi."
      );
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ================================
          SEARCH BOX
      ================================= */}
      <div>
        <label
          htmlFor="business-search"
          className="mb-2 block text-sm font-semibold text-gray-900"
        >
          Cari Bisnis
        </label>

        <div className="relative">
          {/* Search Icon */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <svg
              className="h-5 w-5 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </div>

          <input
            id="business-search"
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);

              if (selectedBusiness) {
                setSelectedBusiness(null);
                setActivationSuccess(false);
                setActivationError("");
                onSelect?.(null);
              }
            }}
            placeholder="Ketik nama bisnis atau alamat..."
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-11 pr-12 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />

          {/* Clear Button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 transition hover:text-gray-700"
              aria-label="Hapus pencarian"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Cari bisnis yang sudah terdaftar di akun ReviewTap Anda.
        </p>
      </div>

      {/* ================================
          SEARCH RESULTS
      ================================= */}
      {query.trim() && !selectedBusiness && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {results.map((business) => (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => handleSelect(business)}
                  className="flex w-full items-start gap-4 p-4 text-left transition hover:bg-gray-50"
                >
                  {/* Business Icon */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
                      <path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" />
                      <path d="M2 21h20" />
                    </svg>
                  </div>

                  {/* Business Information */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900">
                      {business.name}
                    </div>

                    {business.address ? (
                      <div className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-gray-500">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>

                        <span>{business.address}</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-gray-400">
                        Alamat belum tersedia
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="pt-2 text-gray-400">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-6 w-6 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </div>

              <p className="text-sm font-medium text-gray-700">
                Bisnis tidak ditemukan
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Coba gunakan nama bisnis atau alamat yang berbeda.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================
          SELECTED BUSINESS
      ================================= */}
      {selectedBusiness && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/60">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-emerald-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Bisnis Terpilih
              </span>
            </div>

            {!isActivating && !activationSuccess && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-gray-500 transition hover:text-gray-900"
              >
                Ganti
              </button>
            )}
          </div>

          {/* Business */}
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
                  <path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" />
                  <path d="M2 21h20" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-gray-900">
                  {selectedBusiness.name}
                </h3>

                {selectedBusiness.address && (
                  <div className="mt-1 flex items-start gap-1.5 text-sm leading-5 text-gray-600">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>

                    <span>{selectedBusiness.address}</span>
                  </div>
                )}

                {selectedBusiness.google_review_url && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2v20M2 12h20" />
                    </svg>

                    <span>Google Review URL tersedia</span>
                  </div>
                )}
              </div>
            </div>

            {/* ================================
                ACTIVATION ERROR
            ================================= */}
            {activationError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 text-red-500">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16h.01" />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Aktivasi gagal
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-700">
                      {activationError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================
                ACTIVATION SUCCESS
            ================================= */}
            {activationSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-emerald-800">
                      QR Berhasil Diaktifkan
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      QR <strong>{code}</strong> sekarang terhubung ke{" "}
                      <strong>{selectedBusiness.name}</strong>.
                    </p>

                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      Scan QR tersebut untuk menguji apakah pengunjung
                      langsung diarahkan ke halaman Google Review bisnis.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================
                ACTIVATE BUTTON
            ================================= */}
            {!activationSuccess && (
              <button
                type="button"
                onClick={handleActivate}
                disabled={isActivating}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition ${
                  isActivating
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-gray-900 text-white shadow-sm hover:bg-gray-800 active:scale-[0.99]"
                }`}
              >
                {isActivating ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-90"
                        fill="currentColor"
                        d="M21 12a9 9 0 0 1-9 9v-3a6 6 0 0 0 6-6h3Z"
                      />
                    </svg>

                    Mengaktifkan QR...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 3v12" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>

                    Aktifkan QR Code
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================================
          EMPTY STATE
      ================================= */}
      {!query.trim() && !selectedBusiness && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <svg
              className="h-6 w-6 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
              <path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2" />
              <path d="M2 21h20" />
            </svg>
          </div>

          <p className="text-sm font-semibold text-gray-700">
            Pilih bisnis untuk QR ini
          </p>

          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-gray-500">
            Ketik nama bisnis pada kolom pencarian di atas untuk melihat
            bisnis yang tersedia.
          </p>
        </div>
      )}
    </div>
  );
}