"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  name: string;
  code: string;
  businessName: string;
  isActive: boolean;
};

export default function QRCodeDisplay({
  name,
  code,
  businessName,
  isActive,
}: Props) {
  const [qrImage, setQrImage] = useState<string>("");

  useEffect(() => {
    const url = `${window.location.origin}/r/${code}`;

    QRCode.toDataURL(url, {
      width: 500,
      margin: 2,
    })
      .then((dataUrl: string) => {
        setQrImage(dataUrl);
      })
      .catch((error: Error) => {
        console.error("Gagal membuat QR:", error);
      });
  }, [code]);

  function downloadQR() {
    if (!qrImage) {
      return;
    }

    const link = document.createElement("a");

    link.href = qrImage;

    link.download = `${name
      .replace(/\s+/g, "-")
      .toLowerCase()}-qr.png`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  }

 const publicUrl = `/r/${code}`;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">

        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {name}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {businessName}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isActive
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {isActive ? "Aktif" : "Nonaktif"}
        </span>

      </div>

      {/* QR CODE */}
      <div className="mt-6 flex justify-center">

        {qrImage ? (
          <img
            src={qrImage}
            alt={`QR Code ${name}`}
            className="h-64 w-64"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-gray-100">
            <span className="text-sm text-gray-500">
              Membuat QR...
            </span>
          </div>
        )}

      </div>

      {/* KODE QR */}
      <div className="mt-5 rounded-lg bg-gray-50 p-3">

        <p className="text-xs text-gray-500">
          Kode QR
        </p>

        <p className="mt-1 break-all font-mono text-sm font-medium text-gray-900">
          {code}
        </p>

      </div>

      {/* LINK QR */}
      <div className="mt-3 rounded-lg bg-gray-50 p-3">

        <p className="text-xs text-gray-500">
          Link QR
        </p>

        <p className="mt-1 break-all text-xs text-gray-700">
          {publicUrl}
        </p>

      </div>

      {/* DOWNLOAD */}
      <button
        type="button"
        onClick={downloadQR}
        disabled={!qrImage}
        className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {qrImage
          ? "Download QR PNG"
          : "Membuat QR..."}
      </button>

    </div>
  );
}