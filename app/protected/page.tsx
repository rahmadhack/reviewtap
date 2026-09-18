import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

export default async function ProtectedPage() {
  await connection();
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h1>

          <p className="mt-2 text-gray-500">
            Kelola bisnis dan kartu review Google Anda dari satu tempat.
          </p>
        </div>

        {/* WELCOME */}
        <div className="mb-6 rounded-2xl bg-blue-600 p-6 text-white shadow">
          <p className="text-sm opacity-80">
            Selamat datang kembali
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            {user?.email}
          </h2>

          <p className="mt-2 text-sm opacity-80">
            ReviewTap siap membantu meningkatkan review Google bisnis Anda.
          </p>
        </div>

        {/* STATISTICS */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Bisnis
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              0
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Kartu Review
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              0
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Scan QR
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              0
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Tap NFC
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              0
            </p>
          </div>

        </div>

        {/* MENU */}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          <DashboardCard
  title="Bisnis"
  description="Tambahkan dan kelola bisnis Anda."
  href="/protected/businesses"
/>

          <DashboardCard
            title="Kartu Review"
            description="Buat dan kelola kartu review Google."
          />

          <DashboardCard
            title="QR Code"
            description="Buat QR Code untuk pelanggan."
          />

          <DashboardCard
            title="NFC"
            description="Hubungkan kartu NFC ke halaman review."
          />

          <DashboardCard
            title="Analytics"
            description="Pantau scan QR dan tap NFC."
          />

          <DashboardCard
            title="Staff"
            description="Kelola anggota tim bisnis."
          />

        </div>

      </div>
    </main>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-gray-500">
        {description}
      </p>

      {href ? (
        <Link
          href={href}
          className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Kelola
        </Link>
      ) : (
        <button
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Kelola
        </button>
      )}
    </div>
  );
}