"use client";

import { useState } from "react";

type Business = {
  id: string;
  name: string;
};

type Props = {
  id: string;
  serialNumber: string;
  code: string;
  businesses: Business[];
};

export default function EmptyQRCodeCard({
  id,
  serialNumber,
  code,
  businesses,
}: Props) {
  const [businessId, setBusinessId] = useState("");
  const [loading, setLoading] = useState(false);

  async function activateQR() {
    if (!businessId) {
      alert("Pilih bisnis terlebih dahulu.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/qr-codes/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          business_id: businessId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Gagal mengaktifkan QR Code."
        );
      }

      window.location.reload();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengaktifkan QR Code."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500">
            QR TERSEDIA
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-900">
            {serialNumber}
          </h3>
        </div>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          Belum Aktif
        </span>
      </div>

      <div className="mt-5 rounded-xl bg-gray-50 p-4">
        <p className="text-xs text-gray-500">
          Kode QR
        </p>

        <p className="mt-1 break-all font-mono text-sm font-semibold text-gray-900">
          {code}
        </p>
      </div>

      <div className="mt-5">
        <label
          htmlFor={`business-${id}`}
          className="block text-sm font-medium text-gray-700"
        >
          Hubungkan ke Bisnis
        </label>

        <select
          id={`business-${id}`}
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
          disabled={loading}
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
        >
          <option value="">
            Pilih bisnis
          </option>

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

      <button
        type="button"
        onClick={activateQR}
        disabled={loading || !businessId}
        className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Mengaktifkan..." : "Aktifkan QR"}
      </button>
    </div>
  );
}