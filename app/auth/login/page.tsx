"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("LOGIN ERROR:", error);
      setError(error.message);
      setLoading(false);
      return;
    }

    console.log("LOGIN BERHASIL");

    router.replace("/protected");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-xl border border-gray-800 p-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          Login
        </h1>

        <p className="text-gray-400 mb-6">
          Enter your email below to login to your account
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-white"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500 bg-red-950 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-white px-4 py-3 text-black font-medium disabled:opacity-50"
          >
            {loading ? "Login..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}