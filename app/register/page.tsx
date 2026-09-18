"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function RegisterPage() {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRegister(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Registrasi berhasil. Silakan cek email untuk konfirmasi akun."
    );

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-blue-600">
            ReviewTap
          </h1>

          <p className="text-gray-500 mt-2">
            Buat akun baru
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
              : "Daftar"}
          </button>

        </form>

        {message && (
          <div className="mt-5 bg-blue-50 text-blue-700 p-4 rounded-lg text-sm">
            {message}
          </div>
        )}

        <div className="text-center mt-6 text-sm">

          Sudah memiliki akun?

          {" "}

          <Link
            href="/login"
            className="text-blue-600 font-semibold"
          >
            Login
          </Link>

        </div>

      </div>

    </main>
  );
}