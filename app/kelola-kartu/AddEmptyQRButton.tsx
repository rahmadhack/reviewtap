"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddEmptyQRButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/qr-cards/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ??
            "Gagal membuat QR kosong."
        );
      }

      // QR berhasil dibuat.
      // Tetap di halaman Kelola Kartu.
      // QR nantinya bisa dibuka, didownload,
      // dan dicetak terlebih dahulu.
      router.refresh();
    } catch (error) {
      console.error(
        "Create empty QR error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Gagal membuat QR kosong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Membuat QR..."
          : "+ Tambah QR Kosong"}
      </button>

      {error ? (
        <p className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}