"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import JSZip from "jszip";

type QRCodeItem = {
  id: string;
  serial_number: string;
  code: string;
  status: string;
  business_id: string | null;
  google_place_id: string | null;
};

export default function AddEmptyQRButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] =
    useState(false);

  const [showBulkForm, setShowBulkForm] =
    useState(false);
  const [quantity, setQuantity] = useState("10");

  const [createdBulkQRs, setCreatedBulkQRs] =
    useState<QRCodeItem[]>([]);

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

  async function handleBulkCreate() {
    if (bulkLoading) {
      return;
    }

    const amount = Number(quantity);

    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > 100
    ) {
      setError(
        "Jumlah QR harus berupa angka bulat antara 1 sampai 100."
      );

      return;
    }

    setBulkLoading(true);
    setError("");
    setCreatedBulkQRs([]);

    try {
      const response = await fetch(
        "/api/qr-cards/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: amount,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ??
            "Gagal membuat QR masal."
        );
      }

      const createdQRs =
        Array.isArray(result?.qrs)
          ? result.qrs
          : [];

      if (createdQRs.length !== amount) {
        throw new Error(
          "Jumlah QR yang berhasil dibuat tidak sesuai."
        );
      }

      setCreatedBulkQRs(createdQRs);
      setShowBulkForm(false);
      setQuantity("10");

      router.refresh();
    } catch (error) {
      console.error(
        "Bulk create QR error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Gagal membuat QR masal."
      );
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleDownloadBulkQRs() {
    if (
      downloadLoading ||
      createdBulkQRs.length === 0
    ) {
      return;
    }

    setDownloadLoading(true);
    setError("");

    try {
      const zip = new JSZip();

      const baseUrl =
        window.location.origin;

      for (const qr of createdBulkQRs) {
        const qrUrl =
          `${baseUrl}/q/${encodeURIComponent(
            qr.code
          )}`;

        const dataUrl =
          await QRCode.toDataURL(qrUrl, {
            width: 1200,
            margin: 2,
            errorCorrectionLevel: "H",
          });

        const base64Data =
          dataUrl.split(",")[1];

        if (!base64Data) {
          throw new Error(
            `Gagal membuat file QR ${qr.code}.`
          );
        }

        zip.file(
          `${qr.code}.png`,
          base64Data,
          {
            base64: true,
          }
        );
      }

      const zipBlob =
        await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        });

      const downloadUrl =
        URL.createObjectURL(zipBlob);

      const link =
        document.createElement("a");

      link.href = downloadUrl;
      link.download =
        `reviewtap-qr-${createdBulkQRs.length}.zip`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error(
        "Bulk QR download error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Gagal mengunduh QR masal."
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleCreate}
          disabled={
            loading ||
            bulkLoading ||
            downloadLoading
          }
          className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Membuat QR..."
            : "+ Tambah QR Kosong"}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowBulkForm(true);
            setError("");
            setCreatedBulkQRs([]);
          }}
          disabled={
            loading ||
            bulkLoading ||
            downloadLoading
          }
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          + Buat QR Masal
        </button>
      </div>

      {showBulkForm ? (
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-lg sm:w-80">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              Buat QR Masal
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Berapa QR yang ingin dibuat?
            </p>
          </div>

          <input
            type="number"
            min="1"
            max="100"
            value={quantity}
            onChange={(event) =>
              setQuantity(
                event.target.value
              )
            }
            disabled={bulkLoading}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
          />

          <p className="mt-2 text-xs text-gray-500">
            Maksimal 100 QR sekali proses.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowBulkForm(false);
                setError("");
              }}
              disabled={bulkLoading}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleBulkCreate}
              disabled={bulkLoading}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading
                ? "Membuat..."
                : "Buat QR"}
            </button>
          </div>
        </div>
      ) : null}

      {createdBulkQRs.length > 0 ? (
        <div className="w-full rounded-2xl border border-green-200 bg-green-50 p-4 sm:w-80">
          <p className="text-sm font-semibold text-green-900">
            {createdBulkQRs.length} QR berhasil dibuat.
          </p>

          <p className="mt-1 text-xs text-green-700">
            Download semua QR dalam satu file ZIP.
          </p>

          <button
            type="button"
            onClick={handleDownloadBulkQRs}
            disabled={downloadLoading}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloadLoading
              ? "Menyiapkan ZIP..."
              : `Download ${createdBulkQRs.length} QR`}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}