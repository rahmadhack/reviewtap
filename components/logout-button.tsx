"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {

  const supabase = createClient();

  async function logout() {

    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  return (

    <button
      onClick={logout}
      className="bg-red-500 text-white px-4 py-2 rounded-lg"
    >
      Logout
    </button>

  );
}