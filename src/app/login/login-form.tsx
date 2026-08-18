"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  initialError?: string;
};

export function LoginForm({ initialError }: LoginFormProps) {
  const [error, setError] = useState(initialError ?? "");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResetError("");
    setResetMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  async function handlePasswordReset() {
    setResetLoading(true);
    setError("");
    setResetError("");
    setResetMessage("");

    const form = formRef.current;

    if (!form) {
      setResetError("Het formulier kon niet worden gelezen.");
      setResetLoading(false);
      return;
    }

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const supabase = createClient();
    const resetRedirectUrl = `${window.location.origin}/auth/callback?next=/setup-password`;

    if (!email) {
      setResetError("Vul eerst je e-mailadres in.");
      setResetLoading(false);
      return;
    }

    if (!resetRedirectUrl) {
      setResetError("De herstelpagina kon niet worden voorbereid.");
      setResetLoading(false);
      return;
    }

    const { error: resetErrorResult } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl
    });

    if (resetErrorResult) {
      setResetError(resetErrorResult.message);
      setResetLoading(false);
      return;
    }

    setResetMessage(`We hebben een herstelmail gestuurd naar ${email}.`);
    setResetLoading(false);
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-900">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          onChange={() => {
            if (resetMessage) {
              setResetMessage("");
            }
            if (resetError) {
              setResetError("");
            }
          }}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
          placeholder="naam@voorbeeld.be"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-900">
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
          placeholder="Je wachtwoord"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {resetError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {resetError}
        </div>
      ) : null}

      {resetMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {resetMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-pool-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pool-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Inloggen"}
      </button>

      <button
        type="button"
        onClick={handlePasswordReset}
        disabled={resetLoading}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resetLoading ? "Versturen..." : "Wachtwoord vergeten?"}
      </button>

      <p className="text-xs leading-5 text-slate-500">
        Vul je e-mailadres in en we sturen je een link om een nieuw wachtwoord in te stellen.
      </p>
    </form>
  );
}
