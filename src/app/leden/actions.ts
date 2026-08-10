"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function addMember(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw.length > 0 ? emailRaw : null;
  const role = String(formData.get("role") ?? "lid");

  if (!fullName) {
    redirect("/leden?error=Vul%20een%20naam%20in.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    full_name: fullName,
    email,
    role: role === "beheerder" ? "beheerder" : "lid",
    is_active: true
  });

  if (error) {
    redirect(`/leden?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/leden");
  revalidatePath("/beheer");
  redirect("/leden?added=1");
}

export async function updateMember(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw.length > 0 ? emailRaw : null;
  const role = String(formData.get("role") ?? "lid");
  const isActive = String(formData.get("is_active") ?? "true") === "true";

  if (!id) {
    redirect("/leden?error=Ontbrekend%20lid.");
  }

  if (!fullName) {
    redirect("/leden?error=Vul%20een%20naam%20in.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      full_name: fullName,
      email,
      role: role === "beheerder" ? "beheerder" : "lid",
      is_active: isActive
    })
    .eq("id", id);

  if (error) {
    redirect(`/leden?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/leden");
  revalidatePath("/beheer");
  redirect("/leden?updated=1");
}

export async function deleteMember(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/leden?error=Ontbrekend%20lid.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) {
    redirect(`/leden?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/leden");
  revalidatePath("/beheer");
  redirect("/leden?deleted=1");
}
