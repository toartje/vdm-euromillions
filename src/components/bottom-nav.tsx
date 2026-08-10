"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/lib/site";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Onderste navigatie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
        {siteConfig.navigation.map((item) => {
          const active = item.href === pathname;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-2xl px-2 py-3 text-center text-sm font-medium transition",
                active
                  ? "bg-pool-100 text-pool-800"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
