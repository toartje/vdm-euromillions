import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (authData.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="mb-6">
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Inloggen</h1>
          <p className="mt-2 text-sm text-slate-600">
            Alleen uitgenodigde leden kunnen inloggen.
          </p>
        </div>

        <LoginForm initialError={resolvedSearchParams?.error} />
      </div>
    </div>
  );
}
