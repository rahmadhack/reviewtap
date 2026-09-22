"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

type Props = {
  code: string;
  businessName?: string;
  status: string;
};

export default function StaticQRCodeCard({
  code,
  businessName,
  status,
}: Props) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    setQrUrl(`${window.location.origin}/q/${code}`);
  }, [code]);

  function printQR() {
    window.print();
  }

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">

      {/* HEADER */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500">
            QR STATIS
          </p>

          <h3 className="mt-1 text-xl font-bold text-gray-900">
            {code}
          </h3>
        </div>

        <div
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {status === "active" ? "Aktif" : "Tersedia"}
        </div>
      </div>

      {/* QR */}
      <div className="mt-6 flex min-h-[268px] items-center justify-center rounded-2xl border bg-white p-6">

        {qrUrl ? (
          <QRCode
            value={qrUrl}
            size={220}
          />
        ) : (
          <div className="text-sm text-gray-500">
            Membuat QR...
          </div>
        )}

      </div>

      {/* BUSINESS */}
      <div className="mt-4 text-center">
        <p className="font-semibold text-gray-900">
          {businessName || "Belum diaktifkan"}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Scan untuk memberikan review
        </p>
      </div>

      {/* URL */}
      {qrUrl && (
        <div className="mt-4 rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">
            URL QR
          </p>

          <p className="mt-1 break-all text-sm text-gray-700">
            {qrUrl}
          </p>
        </div>
      )}

      {/* BUTTON */}
      <div className="mt-5 flex gap-3">

        <button
          type="button"
          onClick={printQR}
          className="flex-1 rounded-xl bg-black py-3 font-medium text-white hover:bg-gray-800"
        >
          Print QR
        </button>

      </div>
    </div>
  );
}