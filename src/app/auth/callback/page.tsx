"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get("next") ?? "/";

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const supabase = createClient();
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw exchangeError;
        }
      } else if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType
        });

        if (verifyError) {
          throw verifyError;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (data.session) {
        router.replace(nextPath);
        return;
      }

      setError("De uitnodiging kon niet worden verwerkt. Probeer de link opnieuw te openen.");
    }

    completeAuth().catch((callbackError) => {
      if (cancelled) {
        return;
      }

      setError(callbackError instanceof Error ? callbackError.message : "De uitnodiging kon niet worden verwerkt.");
    });

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pool-700">LuckyPool</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Uitnodiging verwerken</h1>
          <p className="mt-2 text-sm text-slate-600">Even geduld, we zetten je account klaar.</p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
