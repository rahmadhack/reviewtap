
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CustomLinkCard = {
  id: string;
  serial_number: string;
  code: string;
  status: string;
  custom_link_url: string | null;
  created_at: string;
};

export default function CustomLinkManager({
  cards,
}: {
  cards: CustomLinkCard[];
}) {
  const router = useRouter();

  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function createQR() {
    const amount = Number(quantity);

    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      setMessage("Jumlah QR harus antara 1 sampai 100.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/custom-link/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: amount }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal membuat QR.");
      }

      setMessage(`${result.quantity} QR Custom Link berhasil dibuat.`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat membuat QR."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">
          Buat QR Custom Link
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          QR yang dibuat di sini tidak tercampur dengan QR Google Review.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-gray-700">
            Jumlah QR
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>

          <button
            type="button"
            onClick={createQR}
            disabled={loading}
            className="self-end rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Membuat QR..." : "Buat QR"}
          </button>
        </div>

        {message && (
          <p aria-live="polite" className="mt-4 text-sm text-gray-700">
            {message}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Daftar QR Custom Link
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length} QR terdaftar
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Belum ada QR Custom Link. Buat QR pertama Anda di atas.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {card.serial_number}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Kode: {card.code}
                  </p>

                  {card.custom_link_url && (
                    <p className="mt-2 break-all text-sm text-blue-600">
                      {card.custom_link_url}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">
                    Dibuat:{" "}
                    {new Date(card.created_at).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <span
                    className={
                      card.status === "active"
                        ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                        : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                    }
                  >
                    {card.status === "active" ? "Aktif" : "Belum Aktif"}
                  </span>

                  <a
                    href={`/q/${encodeURIComponent(card.code)}/setup-custom`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {card.status === "active" ? "Kelola" : "Aktifkan"}
                  </a>

                                    <a
                    href={`/kelola-kartu/qr/${encodeURIComponent(card.code)}`}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Buka QR
                 
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
