import Link from "next/link";

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
  const isActive = status === "active";

  const isEmpty =
    status === "empty";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="border-b border-gray-100 p-5">

        <div className="flex items-start justify-between gap-4">

          <div>

            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              QR Card
            </p>

            <h3 className="mt-1 text-lg font-bold text-gray-900">
              {serialNumber}
            </h3>

          </div>

          {/* STATUS */}

          {isActive ? (

            <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Aktif
            </span>

          ) : isEmpty ? (

            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Kosong
            </span>

          ) : (

            <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
              {status}
            </span>

          )}

        </div>

      </div>

      {/* ================================================= */}
      {/* CONTENT */}
      {/* ================================================= */}

      <div className="p-5">

        {/* CODE */}

        <div>

          <p className="text-xs text-gray-400">
            Kode QR
          </p>

          <p className="mt-1 font-mono text-sm font-medium text-gray-900">
            {code}
          </p>

        </div>

        {/* BUSINESS */}

        <div className="mt-5">

          <p className="text-xs text-gray-400">
            Bisnis
          </p>

          <p className="mt-1 text-sm font-medium text-gray-900">
            {businessName ?? "Belum terhubung"}
          </p>

        </div>

        {/* PLACE ID */}

        <div className="mt-5">

          <p className="text-xs text-gray-400">
            Google Place ID
          </p>

          <p className="mt-1 truncate font-mono text-xs text-gray-500">
            {googlePlaceId ??
              "Belum tersedia"}
          </p>

        </div>

        {/* ================================================= */}
        {/* STATUS INFO */}
        {/* ================================================= */}

        {isEmpty && (

          <div className="mt-5 rounded-xl bg-gray-50 p-4">

            <p className="text-sm font-medium text-gray-900">
              QR siap digunakan
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Buka QR untuk melihat dan
              mendownload QR kosong yang
              dapat dicetak.
            </p>

          </div>

        )}

        {isActive && (

          <div className="mt-5 rounded-xl bg-green-50 p-4">

            <p className="text-sm font-medium text-green-900">
              QR sudah aktif
            </p>

            <p className="mt-1 text-xs leading-5 text-green-700">
              Saat QR discan, pelanggan akan
              diarahkan ke halaman Google Review.
            </p>

          </div>

        )}

        {/* ================================================= */}
        {/* BUTTON */}
        {/* ================================================= */}

        <div className="mt-5 flex gap-3">

          {/* BUKA QR */}

          <Link
          href={`/kelola-kartu/qr/${encodeURIComponent(code)}`}
            className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Buka QR
          </Link>

        </div>

      </div>

    </div>
  );
}
