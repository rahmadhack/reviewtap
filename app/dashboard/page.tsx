import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {

  const supabase =
    await createClient();

  const {
    data: {
      user
    }
  } = await supabase.auth.getUser();

  if (!user) {
   redirect("/auth/login");
  }

  return (

    <main className="min-h-screen bg-gray-100">

      <header className="bg-white border-b">

        <div className="max-w-7xl mx-auto px-6 py-5">

          <h1 className="text-2xl font-bold">
            ReviewTap
          </h1>

        </div>

      </header>

      <div className="max-w-7xl mx-auto p-6">

        <h2 className="text-3xl font-bold">
          Dashboard
        </h2>

        <p className="text-gray-500 mt-2">
          Selamat datang, {user.email}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">

          <div className="bg-white rounded-xl p-6 shadow">

            <p className="text-gray-500">
              Bisnis
            </p>

            <p className="text-4xl font-bold mt-2">
              0
            </p>

          </div>

          <div className="bg-white rounded-xl p-6 shadow">

            <p className="text-gray-500">
              Kartu
            </p>

            <p className="text-4xl font-bold mt-2">
              0
            </p>

          </div>

          <div className="bg-white rounded-xl p-6 shadow">

            <p className="text-gray-500">
              Total Tap
            </p>

            <p className="text-4xl font-bold mt-2">
              0
            </p>

          </div>

        </div>

      </div>

    </main>

  );
}