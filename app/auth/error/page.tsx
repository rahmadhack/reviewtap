export default function ErrorPage() {

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">

      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">

        <div className="text-5xl mb-4">
          ❌
        </div>

        <h1 className="text-2xl font-bold">
          Verifikasi Gagal
        </h1>

        <p className="text-gray-500 mt-3">
          Link verifikasi tidak valid atau sudah kedaluwarsa.
        </p>

        <a
          href="/register"
          className="inline-block mt-6 bg-blue-600 text-white px-5 py-3 rounded-lg"
        >
          Kembali ke Register
        </a>

      </div>

    </main>
  );
}