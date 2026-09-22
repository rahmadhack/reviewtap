"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  code: string;
  name: string;
  businessName: string;
  isActive: boolean;
};

export default function QRPreview({
  code,
  name,
  businessName,
  isActive,
}: Props) {
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/q/${code}`;

    QRCode.toDataURL(url, {
      width: 500,
      margin: 2,
    })
      .then((dataUrl) => {
        setQrImage(dataUrl);
      })
      .catch((error) => {
        console.error("Gagal membuat QR:", error);
      });
  }, [code]);

  function downloadQR() {
    if (!qrImage) return;

    const link = document.createElement("a");

    link.href = qrImage;

    link.download = `${name
      .replace(/\s+/g, "-")
      .toLowerCase()}-qr.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function openQR() {
    if (!isActive) return;

    const url = `/q/${code}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      {/* QR IMAGE */}

      <div className="flex justify-center rounded-2xl border bg-white p-6">
        {qrImage ? (
          <img
            src={qrImage}
            alt={`QR Code ${code}`}
            className="h-auto w-full max-w-[320px]"
          />
        ) : (
          <div className="flex h-[320px] w-[320px] items-center justify-center">
            <p className="text-sm text-gray-400">
              Membuat QR...
            </p>
          </div>
        )}
      </div>

      {/* INFORMASI QR */}

      <div className="mt-5 rounded-xl bg-gray-50 p-4">
        <p className="text-xs text-gray-500">
          Bisnis
        </p>

        <p className="mt-1 font-medium text-gray-900">
          {businessName}
        </p>

        <p className="mt-4 text-xs text-gray-500">
          URL QR
        </p>

        <p className="mt-1 break-all text-sm text-gray-600">
          /q/{code}
        </p>
      </div>

      {/* BUKA QR */}

      <button
        type="button"
        onClick={openQR}
        disabled={!isActive}
        className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Buka QR
      </button>

      {/* DOWNLOAD QR */}

      <button
        type="button"
        onClick={downloadQR}
        disabled={!qrImage || !isActive}
        className="mt-3 w-full rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Download QR PNG
      </button>

      {/* QR TIDAK AKTIF */}

      {!isActive && (
        <p className="mt-3 text-center text-xs text-gray-500">
          QR belum aktif.
        </p>
      )}
    </div>
  );
}