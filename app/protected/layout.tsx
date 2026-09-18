import { Suspense } from "react";
import AuthButton from "@/components/auth-button";
import { connection } from "next/server";
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div className="text-xl font-bold text-blue-600">
            ReviewTap
          </div>

          <Suspense fallback={null}>
            <AuthButton />
          </Suspense>

        </div>
      </header>

      <main>
        {children}
      </main>

    </div>
  );
}