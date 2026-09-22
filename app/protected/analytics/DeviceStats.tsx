"use client";

type ScanRow = {
  user_agent: string | null;
};

type Props = {
  scans: ScanRow[];
};

function detectDevice(userAgent: string | null) {
  if (!userAgent) {
    return "Tidak diketahui";
  }

  const ua = userAgent.toLowerCase();

  if (
    ua.includes("ipad") ||
    ua.includes("tablet") ||
    ua.includes("android") && !ua.includes("mobile")
  ) {
    return "Tablet";
  }

  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("android")
  ) {
    return "Mobile";
  }

  return "Desktop";
}

function detectBrowser(userAgent: string | null) {
  if (!userAgent) {
    return "Tidak diketahui";
  }

  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) {
    return "Microsoft Edge";
  }

  if (ua.includes("opr/") || ua.includes("opera")) {
    return "Opera";
  }

  if (ua.includes("chrome/") && !ua.includes("edg/")) {
    return "Chrome";
  }

  if (ua.includes("firefox/")) {
    return "Firefox";
  }

  if (
    ua.includes("safari/") &&
    !ua.includes("chrome/")
  ) {
    return "Safari";
  }

  return "Browser lain";
}

export default function DeviceStats({ scans }: Props) {
  const deviceCounts: Record<string, number> = {};
  const browserCounts: Record<string, number> = {};

  for (const scan of scans) {
    const device = detectDevice(scan.user_agent);
    const browser = detectBrowser(scan.user_agent);

    deviceCounts[device] =
      (deviceCounts[device] ?? 0) + 1;

    browserCounts[browser] =
      (browserCounts[browser] ?? 0) + 1;
  }

  const devices = Object.entries(deviceCounts).sort(
    (a, b) => b[1] - a[1]
  );

  const browsers = Object.entries(browserCounts).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      {/* DEVICE */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Perangkat
          </h2>

          <p className="text-sm text-gray-500">
            Jenis perangkat yang digunakan saat scan QR.
          </p>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-gray-500">
              Belum ada data perangkat.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map(([device, count]) => (
              <div
                key={device}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm shadow-sm">
                    {device === "Mobile"
                      ? "📱"
                      : device === "Tablet"
                        ? "📟"
                        : "💻"}
                  </div>

                  <span className="text-sm font-medium text-gray-900">
                    {device}
                  </span>
                </div>

                <span className="text-sm font-semibold text-gray-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* BROWSER */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Browser
          </h2>

          <p className="text-sm text-gray-500">
            Browser yang digunakan saat scan QR.
          </p>
        </div>

        {browsers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-gray-500">
              Belum ada data browser.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {browsers.map(([browser, count]) => (
              <div
                key={browser}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-900">
                  {browser}
                </span>

                <span className="text-sm font-semibold text-gray-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}