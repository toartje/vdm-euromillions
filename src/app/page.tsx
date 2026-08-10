import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { requireViewer } from "@/lib/supabase/auth";

export default async function HomePage() {
  const { member } = await requireViewer();
  const isAdmin = member.role === "beheerder";

  return (
    <PageShell title="Welkom">
      <section className="rounded-3xl bg-gradient-to-br from-pool-600 to-sky-700 p-6 text-white shadow-soft">
        <h2 className="text-3xl font-black uppercase tracking-[0.18em] text-white sm:text-4xl">
          VDM EuroMillions
        </h2>
      </section>

      {isAdmin ? (
        <section className="grid gap-3">
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
        </section>
      ) : null}
    </PageShell>
  );
}
