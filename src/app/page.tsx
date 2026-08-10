import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireViewer } from "@/lib/supabase/auth";
import { siteConfig } from "@/lib/site";

export default async function HomePage() {
  const { member } = await requireViewer();
  const isAdmin = member.role === "beheerder";

  return (
    <PageShell title="Welkom" subtitle="Hier beheer je straks eenvoudig de EuroMillions-groep.">
      <section className="rounded-3xl bg-gradient-to-br from-pool-600 to-sky-700 p-5 text-white shadow-soft">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-pool-100">
          Startscherm
        </p>
        <h2 className="mt-2 text-2xl font-bold">Alles voor {siteConfig.name} op één plek</h2>
        <p className="mt-3 text-sm leading-6 text-sky-50/90">
          Dit is de eerste basis van de app. Later voegen we trekkingen, betalingen,
          winstberekeningen en ticketuploads toe.
        </p>
      </section>

      <section className="grid gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-900">Wat staat er in fase 1?</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>• Een Nederlandstalige mobiele lay-out</li>
            <li>• Onderste navigatie</li>
            <li>• Een tijdelijke beheerpagina</li>
            <li>• Een centrale appnaam voor alle schermen</li>
          </ul>
        </div>

        {isAdmin ? (
          <>
            <Link
              href="/beheer"
              className="rounded-2xl border border-dashed border-pool-300 bg-pool-50 p-4 text-sm font-medium text-pool-800 transition hover:bg-pool-100"
            >
              Naar beheerpagina
            </Link>

            <Link
              href="/leden"
              className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
            >
              Naar ledenbeheer
            </Link>
          </>
        ) : null}
      </section>
    </PageShell>
  );
}
