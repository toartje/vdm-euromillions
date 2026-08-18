import { Suspense } from "react";

import AuthCallbackClient from "./auth-callback-client";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
          <div className="rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-200">
              <h1 className="mt-3 text-2xl font-bold tracking-tight">Uitnodiging verwerken</h1>
              <p className="mt-2 text-sm text-slate-600">Even geduld, we zetten je account klaar.</p>
            </div>
          </div>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
