
"use client";

import { useMemo, useState } from "react";
import QRCard from "./QRCard";

type QRCardItem = {
  id: string;
  serialNumber: string;
  code: string;
  status: string;
  businessName: string | null;
  googlePlaceId: string | null;
};

type Props = {
  cards: QRCardItem[];
};

export default function QRCardSearch({ cards }: Props) {
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return cards;
    }

    return cards.filter(
      (card) =>
        card.code.toLowerCase().includes(search) ||
        card.serialNumber.toLowerCase().includes(search)
    );
  }, [cards, query]);

  return (
    <>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="qr-card-search"
          className="mb-2 block text-sm font-semibold text-gray-900"
        >
          Cari Kode Kartu
        </label>

        <input
          id="qr-card-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Masukkan kode atau nomor seri kartu..."
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
        />

        <p className="mt-2 text-xs text-gray-500">
          Menampilkan {filteredCards.length} dari {cards.length} kartu.
        </p>
      </div>

      {filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <h3 className="font-semibold text-gray-900">
            Kartu tidak ditemukan
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Periksa kembali kode atau nomor seri kartu yang dimasukkan.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((qr) => (
            <QRCard
              key={qr.id}
              id={qr.id}
              serialNumber={qr.serialNumber}
              code={qr.code}
              status={qr.status}
              businessName={qr.businessName}
              googlePlaceId={qr.googlePlaceId}
            />
          ))}
        </div>
      )}
    </>
  );
}
