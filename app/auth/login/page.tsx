
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

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // 1. LOGIN
      const {
        data: authData,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        console.error("LOGIN ERROR:", loginError.message);
        setError("Email atau password salah. Silakan periksa kembali.");
        return;
      }

      const user = authData.user;

      if (!user) {
        setError("User login tidak ditemukan.");
        return;
      }

      console.log("LOGIN BERHASIL");
      console.log("LOGIN USER ID:", user.id);

      // 2. PERIKSA ROLE USER
      const {
        data: memberships,
        error: membershipError,
      } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id);

      console.table(memberships);
      console.log("MEMBERSHIP ERROR:", membershipError);

      if (membershipError) {
        console.error("ROLE CHECK ERROR:", membershipError);

        await supabase.auth.signOut();

        setError(
          "Gagal memeriksa akses akun. Silakan coba lagi."
        );
        return;
      }

      if (!memberships || memberships.length === 0) {
        await supabase.auth.signOut();

        setError(
          "Akun ini belum terhubung ke organisasi. Hubungi administrator."
        );
        return;
      }

      // 3. RESELLER HANYA DIARAHKAN KE KELOLA KARTU
      const isReseller = memberships.some(
        (membership) => membership.role === "reseller"
      );

      if (isReseller) {
        router.replace("/kelola-kartu");
        router.refresh();
        return;
      }

      // 4. OWNER / ADMIN
      const canAccessDashboard = memberships.some(
        (membership) =>
          membership.role === "owner" ||
          membership.role === "admin"
      );

      if (canAccessDashboard) {
        const params = new URLSearchParams(
          window.location.search
        );

        const next = params.get("next");

        // Izinkan hanya URL internal yang aman.
        const redirectTo =
          next &&
          next.startsWith("/") &&
          !next.startsWith("//") &&
          !next.startsWith("/auth")
            ? next
            : "/protected";

        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // 5. ROLE LAIN TIDAK DIBERI AKSES DASHBOARD
      await supabase.auth.signOut();

      setError(
        "Akun ini tidak memiliki izin untuk mengakses dashboard."
      );
    } catch (err) {
      console.error("LOGIN UNEXPECTED ERROR:", err);

      setError(
        "Terjadi kesalahan saat login. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
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

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-white"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500 bg-red-950 p-3 text-sm text-red-300"
            >
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
