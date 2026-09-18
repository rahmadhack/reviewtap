"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthButton() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex gap-2">
        <a
          href="/login"
          className="rounded-lg border px-4 py-2"
        >
          Login
        </a>

        <a
          href="/register"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white"
        >
          Daftar
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span>
        Hey, {user.email}!
      </span>

      <button
        onClick={handleLogout}
        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}