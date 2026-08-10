"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/supabase/auth";

export async function markBalanceRequestHandled(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/beheer?error=Ontbrekend%20verzoek.");
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("balance_requests")
    .update({
      status: "afgehandeld",
      handled_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    redirect(`/beheer?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect("/beheer?handled=1");
}

export async function adjustMemberBalance(formData: FormData): Promise<void> {
  const memberId = String(formData.get("member_id") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();

  const amount = Number(amountRaw);

  if (!memberId) {
    redirect("/beheer?error=Ontbrekend%20lid.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/beheer?error=Geef%20een%20geldig%20bedrag%20in.");
  }

  if (direction !== "plus" && direction !== "minus") {
    redirect("/beheer?error=Ongeldige%20saldoactie.");
  }

  const { supabase, user } = await requireAdmin();
  const signedAmount = direction === "minus" ? -amount : amount;

  const { error } = await supabase.from("balance_adjustments").insert({
    member_id: memberId,
    amount: signedAmount,
    created_by: user.id
  });

  if (error) {
    redirect(`/beheer?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/beheer");
  revalidatePath("/profiel");
  redirect("/beheer?adjusted=1");
}
