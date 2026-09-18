import { Suspense } from "react";
import BusinessesContent from "./BusinessesContent";

function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">
          Bisnis
        </h1>

        <p className="mt-2 text-gray-600">
          Memuat data bisnis...
        </p>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          Memuat...
        </div>
      </div>
    </main>
  );
}

export default function BusinessesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BusinessesContent />
    </Suspense>
  );
}