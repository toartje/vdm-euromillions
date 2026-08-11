"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type ImageLightboxCardProps = {
  title: string;
  imageUrl: string | null | undefined;
  emptyLabel: string;
};

export function ImageLightboxCard({ title, imageUrl, emptyLabel }: ImageLightboxCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!imageUrl) {
    return (
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-sm text-slate-600">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-2 block w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-slate-300 touch-manipulation"
          aria-label={`${title} fullscreen openen`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <img
            src={imageUrl}
            alt={title}
            className="h-56 w-full rounded-lg object-contain sm:h-72"
          />
          <span className="mt-2 block text-center text-xs font-medium text-slate-500">
            Tik om groter te openen
          </span>
        </button>
      </div>

      {isOpen && mounted
        ? createPortal(
            <div
              role="presentation"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-4"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-6xl"
              >
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-white"
                >
                  Sluiten
                </button>
                <div className="flex max-h-[90vh] items-center justify-center overflow-hidden rounded-2xl bg-black/40 p-2 sm:p-3">
                  <img
                    src={imageUrl}
                    alt={title}
                    className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
