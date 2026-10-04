"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  code: string;
};

export default function QRResetForm({ code }: Props) {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleReset() {
    setError("");
    setSuccess("");

    if (!/^\d{4}$/.test(pin)) {
      setError("PIN harus terdiri dari 4 digit.");
      return;
    }

    const confirmed = window.confirm(
      "Yakin ingin mereset kartu ini?\n\nKartu akan kembali ke status kosong dan harus diaktifkan kembali sebelum digunakan.",
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/qr-codes/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          current_pin: pin,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message || "Kartu gagal di-reset.",
        );
        return;
      }

      setPin("");
      setSuccess("Kartu berhasil di-reset.");

      router.refresh();
    } catch (error) {
      console.error("QR reset error:", error);

      setError(
        "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-900">
        Reset Kartu
      </p>

      <p className="mt-1 text-sm leading-6 text-red-700">
        Reset akan memutuskan kartu dari Google Business
        dan mengembalikan kartu ke kondisi kosong.
      </p>

      <div className="mt-4">
        <label className="text-xs font-semibold text-red-900">
          PIN Saat Ini
        </label>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) =>
            setPin(
              e.target.value
                .replace(/\D/g, "")
                .slice(0, 4),
            )
          }
          placeholder="••••"
          className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-center tracking-[0.5em] text-slate-900 outline-none focus:border-red-400"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-600">
          {success}
        </div>
      )}

      <button
        type="button"
        onClick={handleReset}
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Mereset Kartu..." : "Reset Kartu"}
      </button>
    </div>
  );
}