"use client";

import { useState } from "react";

type Business = {
  id: string;
  name: string;
  google_review_url: string | null;
};

export default function CreateQRCodeForm({
  businesses,
}: {
  businesses: Business[];
}) {
  const [businessId, setBusinessId] = useState(
    businesses[0]?.id || ""
  );

  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (!businessId) {
      setMessage("Pilih bisnis terlebih dahulu.");
      return;
    }

    if (!name.trim()) {
      setMessage("Nama QR wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/review-links",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            business_id: businessId,
            name: name.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error || "Gagal membuat QR Code."
        );
        return;
      }

      setMessage(
        `QR Code berhasil dibuat. Kode: ${result.reviewLink.code}`
      );

      setName("");

    } catch {
      setMessage("Terjadi kesalahan koneksi.");

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">

      <h2 className="text-xl font-bold text-gray-900">
        Buat QR Code
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        Buat link QR Code untuk Google Review.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
      >

        <div>
          <label
            htmlFor="business"
            className="block text-sm font-medium text-gray-700"
          >
            Bisnis
          </label>

          <select
            id="business"
            value={businessId}
            onChange={(event) =>
              setBusinessId(event.target.value)
            }
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
          >
            {businesses.map((business) => (
              <option
                key={business.id}
                value={business.id}
              >
                {business.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="qr-name"
            className="block text-sm font-medium text-gray-700"
          >
            Nama QR Code
          </label>

          <input
            id="qr-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Contoh: QR Kasir"
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3"
          />

          <p className="mt-2 text-xs text-gray-500">
            Gunakan nama sesuai lokasi QR, misalnya:
            Kasir, Meja 1, Banner, atau Struk.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Membuat..."
            : "+ Buat QR Code"}
        </button>

        {message && (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            {message}
          </div>
        )}

      </form>
    </div>
  );
}