"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterPageContent() {
  const searchParams = useSearchParams();

  const invite = searchParams.get("invite") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleRegister(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setSuccess(false);

    if (!invite) {
      setMessage(
        "Anda membutuhkan invite reseller untuk membuat akun."
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/reseller-sign-up",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
            invite,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ||
            "Registrasi gagal. Silakan coba lagi."
        );
        setLoading(false);
        return;
      }

      setSuccess(true);
      setMessage(
        result.message ||
          "Registrasi berhasil. Silakan cek email untuk konfirmasi akun."
      );

      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error(
        "Reseller signup error:",
        error
      );

      setMessage(
        "Terjadi kesalahan koneksi. Silakan coba lagi."
      );
    }

    setLoading(false);
  }

  if (!invite) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-3xl font-bold text-blue-600">
            ReviewTap
          </div>

          <h1 className="text-xl font-bold text-gray-900 mt-6">
            Akses Terbatas
          </h1>

          <p className="text-gray-500 mt-2">
            Pendaftaran akun reseller hanya dapat
            dilakukan menggunakan invite resmi
            dari ReviewTap.
          </p>

          <Link
            href="/auth/login"
            className="inline-block mt-6 text-blue-600 font-semibold"
          >
            Kembali ke Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">
            ReviewTap
          </h1>

          <p className="text-gray-500 mt-2">
            Daftar sebagai Reseller
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Nama Lengkap
            </label>

            <input
              type="text"
              required
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              className="w-full border rounded-lg p-3"
              placeholder="Nama Anda"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full border rounded-lg p-3"
              placeholder="email@contoh.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Password
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full border rounded-lg p-3"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Mendaftarkan..."
              : "Daftar sebagai Reseller"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-5 p-4 rounded-lg text-sm ${
              success
                ? "bg-green-50 text-green-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="text-center mt-6 text-sm">
          Sudah memiliki akun?{" "}
          <Link
            href="/auth/login"
            className="text-blue-600 font-semibold"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
          <div className="text-gray-500">
            Memuat...
          </div>
        </main>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}