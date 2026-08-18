"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ImageLightboxCard } from "@/components/image-lightbox-card";
import { createClient } from "@/lib/supabase/client";

function getFileExtension(fileName: string) {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

async function uploadTrekkingPhoto(
  drawDate: string,
  kind: "bought" | "payout",
  file: File
) {
  const supabase = createClient();
  const extension = getFileExtension(file.name);
  const filePath = `trekkingen/${drawDate}/${kind}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("trekking-fotos")
    .upload(filePath, file, {
      contentType: file.type || "image/jpeg",
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from("trekking-fotos").getPublicUrl(filePath);
  return data.publicUrl;
}

type TrekkingPhotoFormProps = {
  drawDate: string;
  weekday: string;
  boughtTicketImageUrl?: string | null;
  payoutTicketImageUrl?: string | null;
};

export function TrekkingPhotoForm({
  drawDate,
  weekday,
  boughtTicketImageUrl,
  payoutTicketImageUrl
}: TrekkingPhotoFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boughtPreview, setBoughtPreview] = useState<string | null>(null);
  const [payoutPreview, setPayoutPreview] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const boughtFile = formData.get("bought_ticket_image");
      const payoutFile = formData.get("payout_ticket_image");

      let nextBoughtUrl = boughtTicketImageUrl ?? null;
      let nextPayoutUrl = payoutTicketImageUrl ?? null;

      if (boughtFile instanceof File && boughtFile.size > 0) {
        nextBoughtUrl = await uploadTrekkingPhoto(drawDate, "bought", boughtFile);
      }

      if (payoutFile instanceof File && payoutFile.size > 0) {
        nextPayoutUrl = await uploadTrekkingPhoto(drawDate, "payout", payoutFile);
      }

      const supabase = createClient();
      const { error: updateError } = await supabase.from("trekkings").upsert(
        {
          draw_date: drawDate,
          weekday,
          bought_ticket_image_url: nextBoughtUrl,
          payout_ticket_image_url: nextPayoutUrl
        },
        { onConflict: "draw_date" }
      );

      if (updateError) {
        throw new Error(updateError.message);
      }

      router.replace(`/trekkingen?date=${encodeURIComponent(drawDate)}&photos=1`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Foto's opslaan is mislukt.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">Beheer: foto&apos;s</p>
      <p className="mt-1 text-sm text-slate-600">
        Voeg hier een foto toe van de aangekochte lotjes of van de lotjes bij uitbetaling. Op gsm kan je kiezen
        tussen de camera of een foto uit je galerij.
      </p>

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-slate-500">Foto aangekochte lotjes</span>
          <input
            name="bought_ticket_image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              setBoughtPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-slate-500">Foto lotjes bij uitbetaling</span>
          <input
            name="payout_ticket_image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              setPayoutPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
          />
        </label>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-pool-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pool-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Bezig..." : "Foto's opslaan"}
        </button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ImageLightboxCard
          title="Aangekochte lotjes"
          imageUrl={boughtPreview ?? boughtTicketImageUrl}
          emptyLabel="Nog geen foto toegevoegd."
        />

        <ImageLightboxCard
          title="Lotjes bij uitbetaling"
          imageUrl={payoutPreview ?? payoutTicketImageUrl}
          emptyLabel="Nog geen foto toegevoegd."
        />
      </div>
    </div>
  );
}
