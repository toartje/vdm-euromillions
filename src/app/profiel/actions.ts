"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMemberBalance } from "@/lib/supabase/balance";
import { requireViewer } from "@/lib/supabase/auth";

export async function createBalanceRequest(formData: FormData): Promise<void> {
  const requestType = String(formData.get("request_type") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountRaw);

  if (requestType !== "storten" && requestType !== "uitbetalen") {
    redirect("/profiel?error=Ongeldige%20melding.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/profiel?error=Geef%20een%20geldig%20bedrag%20in.");
  }

  const { supabase, member } = await requireViewer();
  const currentBalance = await getMemberBalance(supabase, member.id);

  if (requestType === "uitbetalen" && amount > currentBalance) {
    redirect("/profiel?error=Je%20kunt%20niet%20meer%20uitbetalen%20dan%20je%20saldo.");
  }

  const { error } = await supabase.from("balance_requests").insert({
    member_id: member.id,
    request_type: requestType,
    amount: amount.toFixed(2)
  });

  if (error) {
    redirect(`/profiel?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profiel");
  revalidatePath("/beheer");
  redirect(`/profiel?requested=${encodeURIComponent(requestType)}&amount=${encodeURIComponent(amount.toFixed(2))}`);
}
