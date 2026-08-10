import type { ReactNode } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { siteConfig } from "@/lib/site";

type PageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PageShell({ title, subtitle, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-24 pt-6">
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pool-700">
            {siteConfig.name}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
        </header>

        <div className="flex-1 space-y-4">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
