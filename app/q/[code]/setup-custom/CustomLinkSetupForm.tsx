
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  code: string;
  serialNumber: string;
};

export default function CustomLinkSetupForm({
  code,
  serialNumber,
}: Props) {
  const router = useRouter();

  const [currentPin, setCurrentPin] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [newPin, setNewPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!/^\d{4}$/.test(currentPin)) {
      setError("PIN saat ini harus terdiri dari 4 digit.");
      return;
    }

    if (newPin && !/^\d{4}$/.test(newPin)) {
      setError("PIN baru harus terdiri dari 4 digit.");
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(destinationUrl.trim());
    } catch {
      setError("Masukkan URL yang lengkap, termasuk https://.");
      return;
    }

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      setError("URL harus menggunakan http:// atau https://.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/custom-link/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          current_pin: currentPin,
          custom_link_url: parsedUrl.href,
          new_pin: newPin || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "QR Custom Link gagal diaktifkan."
        );
      }

      setSuccess("QR berhasil diaktifkan. Membuka halaman QR...");

      router.replace(`/q/${encodeURIComponent(code)}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengaktifkan QR."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div>
        <label
          htmlFor="destination-url"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          URL Tujuan
        </label>

        <input
          id="destination-url"
          type="url"
          required
          value={destinationUrl}
          onChange={(event) => setDestinationUrl(event.target.value)}
          placeholder="https://www.instagram.com/akunanda"
          autoComplete="url"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <p className="mt-2 text-xs text-gray-500">
          Contoh: Instagram, WhatsApp, website, atau tautan Google Drive.
          Pastikan tautan bisa dibuka oleh orang yang memindai QR.
        </p>
      </div>

      <div>
        <label
          htmlFor="current-pin"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          PIN Saat Ini
        </label>

        <input
          id="current-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          value={currentPin}
          onChange={(event) =>
            setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="Masukkan 4 digit PIN"
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label
          htmlFor="new-pin"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          PIN Baru (Opsional)
        </label>

        <input
          id="new-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          value={newPin}
          onChange={(event) =>
            setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="Kosongkan jika tidak ingin mengganti PIN"
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Mengaktifkan..." : "Aktifkan Custom Link"}
      </button>

      <p className="text-center text-xs text-gray-400">
        Kartu: {serialNumber}
      </p>
    </form>
  );
}
