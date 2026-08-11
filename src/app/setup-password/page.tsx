"use client";

import { useEffect, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SetupPasswordPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const supabase = createClient();
      const { data, error: userError } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Open deze pagina via je uitnodigingslink.");
        setLoading(false);
        return;
      }

      setEmail(data.user.email ?? null);
      setLoading(false);
    }

    loadUser().catch((loadError) => {
      if (!active) {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Accountgegevens konden niet worden geladen.");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (password.length < 8) {
      setError("Gebruik minstens 8 tekens.");
      setSaving(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("De wachtwoorden komen niet overeen.");
      setSaving(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      window.location.href = "/";
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Wachtwoord instellen is mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pool-700">LuckyPool</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Wachtwoord instellen</h1>
          <p className="mt-2 text-sm text-slate-600">
            {email ? `Welkom ${email}. Kies je eigen wachtwoord.` : "Kies je eigen wachtwoord voor je account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
          {loading ? (
            <p className="text-sm text-slate-600">Je account wordt gecontroleerd...</p>
          ) : null}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-900">
              Nieuw wachtwoord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
              placeholder="Minstens 8 tekens"
            />
          </div>

          <div>
            <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-900">
              Wachtwoord herhalen
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
              placeholder="Herhaal je wachtwoord"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Wachtwoord ingesteld.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving || loading}
            className="w-full rounded-2xl bg-pool-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pool-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Bezig..." : "Wachtwoord opslaan"}
          </button>
        </form>
      </div>
    </div>
  );
}
