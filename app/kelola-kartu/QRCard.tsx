"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  serialNumber: string;
  code: string;
  status: string;
  businessName: string | null;
  googlePlaceId: string | null;
};

export default function QRCard({
  id,
  serialNumber,
  code,
  status,
  businessName,
  googlePlaceId,
}: Props) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const isActive = status === "active";
  const isEmpty = status === "empty";

  async function handleDelete() {
    const message = isActive
      ? `QR ${code} sedang aktif dan terhubung ke bisnis.\n\nHapus QR ini?\n\nHistori scan tetap disimpan, tetapi QR fisik ini tidak akan lagi bekerja.`
      : `Hapus QR ${code}?\n\nQR ini akan dihapus permanen.`;

    const confirmed = window.confirm(message);

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/qr-cards/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Gagal menghapus QR."
        );
      }

      router.refresh();
    } catch (err) {
      console.error("Delete QR error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus QR."
      );

      setDeleting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-5">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              QR Card
            </p>

            <h3 className="mt-1 text-lg font-bold text-gray-900">
              {code}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {serialNumber}
            </p>
          </div>

          <div>
            {isActive ? (
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                Aktif
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                Kosong
              </span>
            )}
          </div>
        </div>

        {/* BUSINESS */}
        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-500">
            Bisnis
          </p>

          <p className="mt-1 text-sm font-semibold text-gray-900">
            {businessName || "Belum terhubung"}
          </p>

          {googlePlaceId && (
            <p className="mt-1 truncate text-xs text-gray-400">
              Place ID: {googlePlaceId}
            </p>
          )}
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* BUTTONS */}
        <div className="mt-5 flex flex-col gap-3">
          {/* BUKA QR */}
          <Link
            href={`/kelola-kartu/qr/${encodeURIComponent(code)}`}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Buka QR
          </Link>

          {/* HAPUS QR */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Menghapus..." : "Hapus QR"}
          </button>
        </div>
      </div>
    </div>
  );
}