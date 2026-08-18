"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMemberBalance } from "@/lib/supabase/balance";
import { requireAdmin, requireViewer } from "@/lib/supabase/auth";

function parseDrawDate(formData: FormData) {
  return String(formData.get("draw_date") ?? "").trim();
}

function parseWeekday(formData: FormData) {
  return String(formData.get("weekday") ?? "").trim();
}

function parseImageUrl(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function getFileExtension(fileName: string) {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

async function uploadTrekkingPhoto(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  fileEntry: FormDataEntryValue | null,
  drawDate: string,
  kind: "bought" | "payout"
) {
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return null;
  }

  const extension = getFileExtension(fileEntry.name);
  const filePath = `trekkingen/${drawDate}/${kind}-${crypto.randomUUID()}.${extension}`;
  const fileData = new Uint8Array(await fileEntry.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("trekking-fotos")
    .upload(filePath, fileData, {
      contentType: fileEntry.type || "image/jpeg",
      upsert: true
    });

  if (uploadError) {
    redirect(`/trekkingen?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data } = supabase.storage.from("trekking-fotos").getPublicUrl(filePath);
  return data.publicUrl;
}

function parseNumberField(formData: FormData, name: string, label: string, min: number, max: number) {
  const raw = String(formData.get(name) ?? "").trim();

  if (!raw) {
    redirect(`/trekkingen?error=${encodeURIComponent(`${label} ontbreekt.`)}`);
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    redirect(`/trekkingen?error=${encodeURIComponent(`${label} is ongeldig.`)}`);
  }

  return value;
}

function parseOptionalPrize(formData: FormData) {
  const raw = String(formData.get("total_prize") ?? "").trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    redirect("/trekkingen?error=Geef%20een%20geldig%20winstbedrag%20in.");
  }

  return value;
}

function parseBooleanField(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim().toLowerCase();
  return value === "true" || value === "on" || value === "1";
}

async function pruneCompletedTrekkings(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]
) {
  const { data: completedTrekkings, error } = await supabase
    .from("trekkings")
    .select("id")
    .in("status", ["resultaat_ingevuld", "verwerkt"])
    .order("draw_date", { ascending: false })
    .range(4, 1000);

  if (error) {
    console.error("Kon afgeronde trekkingen niet beperken.", error);
    return;
  }

  const idsToDelete = (completedTrekkings ?? []).map((trekking) => trekking.id);

  if (!idsToDelete.length) {
    return;
  }

  const { error: deleteError } = await supabase.from("trekkings").delete().in("id", idsToDelete);

  if (deleteError) {
    console.error("Kon oude afgeronde trekkingen niet verwijderen.", deleteError);
  }
}

export async function setTrekkingParticipation(formData: FormData): Promise<void> {
  const drawDate = parseDrawDate(formData);
  const weekday = parseWeekday(formData);
  const isPlaying = String(formData.get("is_playing") ?? "").trim() === "true";

  if (!drawDate) {
    redirect("/trekkingen?error=Ontbrekende%20trekking.");
  }

  if (weekday !== "dinsdag" && weekday !== "vrijdag") {
    redirect("/trekkingen?error=Ongeldige%20trekkingsdag.");
  }

  const { supabase, member } = await requireViewer();
  const { data: trekking, error: trekkingError } = await supabase
    .from("trekkings")
    .select("id")
    .eq("draw_date", drawDate)
    .maybeSingle();

  if (trekkingError) {
    redirect(`/trekkingen?error=${encodeURIComponent(trekkingError.message)}`);
  }

  const { data: currentParticipation, error: participationError } = trekking
    ? await supabase
        .from("trekking_participations")
        .select("is_playing")
        .eq("trekking_id", trekking.id)
        .eq("member_id", member.id)
        .maybeSingle()
    : { data: null, error: null };

  if (participationError) {
    redirect(`/trekkingen?error=${encodeURIComponent(participationError.message)}`);
  }

  if (isPlaying && currentParticipation?.is_playing !== true) {
    const currentMemberBalance = await getMemberBalance(supabase, member.id);

    if (currentMemberBalance < 10) {
      redirect("/trekkingen?error=Je%20hebt%20onvoldoende%20saldo%20om%20mee%20te%20spelen.");
    }
  }

  const { error } = await supabase.rpc("set_trekking_participation", {
    p_draw_date: drawDate,
    p_weekday: weekday,
    p_is_playing: isPlaying
  });

  if (error) {
    redirect(`/trekkingen?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trekkingen");
  revalidatePath("/profiel");
  revalidatePath("/beheer");

  redirect(`/trekkingen?date=${encodeURIComponent(drawDate)}`);
}

export async function saveTrekkingPhotos(formData: FormData): Promise<void> {
  const drawDate = parseDrawDate(formData);
  const weekday = parseWeekday(formData);

  if (!drawDate) {
    redirect("/trekkingen?error=Ontbrekende%20trekking.");
  }

  if (weekday !== "dinsdag" && weekday !== "vrijdag") {
    redirect("/trekkingen?error=Ongeldige%20trekkingsdag.");
  }

  const { supabase } = await requireAdmin();
  const boughtTicketImageUrl =
    (await uploadTrekkingPhoto(
      supabase,
      formData.get("bought_ticket_image"),
      drawDate,
      "bought"
    )) ?? parseImageUrl(formData.get("existing_bought_ticket_image_url"));
  const payoutTicketImageUrl =
    (await uploadTrekkingPhoto(
      supabase,
      formData.get("payout_ticket_image"),
      drawDate,
      "payout"
    )) ?? parseImageUrl(formData.get("existing_payout_ticket_image_url"));

  const payload: Record<string, string> = {
    draw_date: drawDate,
    weekday
  };

  if (boughtTicketImageUrl) {
    payload.bought_ticket_image_url = boughtTicketImageUrl;
  }

  if (payoutTicketImageUrl) {
    payload.payout_ticket_image_url = payoutTicketImageUrl;
  }

  const { data: existingTrekking, error: loadError } = await supabase
    .from("trekkings")
    .select("id")
    .eq("draw_date", drawDate)
    .maybeSingle();

  if (loadError) {
    redirect(`/trekkingen?error=${encodeURIComponent(loadError.message)}`);
  }

  const mutation = existingTrekking
    ? supabase.from("trekkings").update(payload).eq("id", existingTrekking.id)
    : supabase.from("trekkings").insert(payload);

  const { error } = await mutation;

  if (error) {
    redirect(`/trekkingen?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trekkingen");
  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect(`/trekkingen?date=${encodeURIComponent(drawDate)}&photos=1`);
}

export async function closeTrekking(formData: FormData): Promise<void> {
  const drawDate = parseDrawDate(formData);
  const weekday = parseWeekday(formData);

  if (!drawDate) {
    redirect("/trekkingen?error=Ontbrekende%20trekking.");
  }

  if (weekday !== "dinsdag" && weekday !== "vrijdag") {
    redirect("/trekkingen?error=Ongeldige%20trekkingsdag.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("trekkings").upsert(
    {
      draw_date: drawDate,
      weekday,
      status: "gesloten"
    },
    { onConflict: "draw_date" }
  );

  if (error) {
    redirect(`/trekkingen?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trekkingen");
  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect(`/trekkingen?date=${encodeURIComponent(drawDate)}&closed=1`);
}

export async function reopenTrekking(formData: FormData): Promise<void> {
  const drawDate = parseDrawDate(formData);
  const weekday = parseWeekday(formData);

  if (!drawDate) {
    redirect("/trekkingen?error=Ontbrekende%20trekking.");
  }

  if (weekday !== "dinsdag" && weekday !== "vrijdag") {
    redirect("/trekkingen?error=Ongeldige%20trekkingsdag.");
  }

  const { supabase } = await requireAdmin();
  const { data: trekking, error: loadError } = await supabase
    .from("trekkings")
    .select("id, status")
    .eq("draw_date", drawDate)
    .maybeSingle();

  if (loadError) {
    redirect(`/trekkingen?error=${encodeURIComponent(loadError.message)}`);
  }

  if (!trekking) {
    redirect("/trekkingen?error=Geen%20trekking%20gevonden.");
  }

  if (trekking.status === "verwerkt") {
    redirect("/trekkingen?error=Deze%20trekking%20is%20al%20verwerkt.");
  }

  const { error } = await supabase
    .from("trekkings")
    .update({
      weekday,
      status: "open"
    })
    .eq("id", trekking.id);

  if (error) {
    redirect(`/trekkingen?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trekkingen");
  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect(`/trekkingen?date=${encodeURIComponent(drawDate)}&reopened=1`);
}

export async function resetTrekking(formData: FormData): Promise<void> {
  const drawDate = parseDrawDate(formData);
  const weekday = parseWeekday(formData);

  if (!drawDate) {
    redirect("/trekkingen?error=Ontbrekende%20trekking.");
  }

  if (weekday !== "dinsdag" && weekday !== "vrijdag") {
    redirect("/trekkingen?error=Ongeldige%20trekkingsdag.");
  }

  const { supabase } = await requireAdmin();
  const { data: trekking, error: loadError } = await supabase
    .from("trekkings")
    .select("id")
    .eq("draw_date", drawDate)
    .maybeSingle();

  if (loadError) {
    redirect(`/trekkingen?error=${encodeURIComponent(loadError.message)}`);
  }

  if (!trekking) {
    redirect("/trekkingen?error=Geen%20trekking%20gevonden.");
  }

  const { error } = await supabase
    .from("trekkings")
    .update({
      weekday,
      status: "open",
      winning_numbers: null,
      winning_stars: null,
      total_prize: null,
      bought_ticket_image_url: null,
      payout_ticket_image_url: null
    })
    .eq("id", trekking.id);

  if (error) {
    redirect(`/trekkingen?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trekkingen");
  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect(`/trekkingen?date=${encodeURIComponent(drawDate)}&reset=1`);
}

export async function saveTrekkingResult(formData: FormData): Promise<void> {
  const drawDate = parseDrawDate(formData);
  const weekday = parseWeekday(formData);
  const distributeWinnings = parseBooleanField(formData, "distribute_winnings");
  const totalPrize = parseOptionalPrize(formData);

  if (!drawDate) {
    redirect("/trekkingen?error=Ontbrekende%20trekking.");
  }

  if (weekday !== "dinsdag" && weekday !== "vrijdag") {
    redirect("/trekkingen?error=Ongeldige%20trekkingsdag.");
  }

  const winningNumbers = [
    parseNumberField(formData, "winning_number_1", "Winnend nummer 1", 1, 50),
    parseNumberField(formData, "winning_number_2", "Winnend nummer 2", 1, 50),
    parseNumberField(formData, "winning_number_3", "Winnend nummer 3", 1, 50),
    parseNumberField(formData, "winning_number_4", "Winnend nummer 4", 1, 50),
    parseNumberField(formData, "winning_number_5", "Winnend nummer 5", 1, 50)
  ];
  const winningStars = [
    parseNumberField(formData, "winning_star_1", "Ster 1", 1, 12),
    parseNumberField(formData, "winning_star_2", "Ster 2", 1, 12)
  ];

  if (new Set(winningNumbers).size !== winningNumbers.length) {
    redirect("/trekkingen?error=De%20winnende%20nummers%20moeten%20verschillend%20zijn.");
  }

  if (new Set(winningStars).size !== winningStars.length) {
    redirect("/trekkingen?error=De%20sterren%20moeten%20verschillend%20zijn.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("save_trekking_result", {
    p_draw_date: drawDate,
    p_weekday: weekday,
    p_winning_numbers: winningNumbers,
    p_winning_stars: winningStars,
    p_total_prize: totalPrize,
    p_bought_ticket_image_url: parseImageUrl(formData.get("bought_ticket_image_url")),
    p_payout_ticket_image_url: parseImageUrl(formData.get("payout_ticket_image_url")),
    p_distribute_winnings: distributeWinnings
  });

  if (error) {
    redirect(`/trekkingen?error=${encodeURIComponent(error.message)}`);
  }

  await pruneCompletedTrekkings(supabase);
  revalidatePath("/trekkingen");
  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect(
    `/trekkingen?date=${encodeURIComponent(drawDate)}&completed=1${distributeWinnings ? "&distributed=1" : ""}`
  );
}
