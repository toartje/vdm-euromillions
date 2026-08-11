"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient, getSiteUrl } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function addMember(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw.length > 0 ? emailRaw : null;
  const role = String(formData.get("role") ?? "lid");

  if (!fullName) {
    redirect("/leden?error=Vul%20een%20naam%20in.");
  }

  if (!email) {
    redirect("/leden?error=Vul%20een%20e-mail%20in.");
  }

  const supabase = createAdminClient();
  const redirectTo = `${getSiteUrl()}/auth/callback?next=/setup-password`;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo
  });

  if (inviteError) {
    redirect(`/leden?error=${encodeURIComponent(inviteError.message)}`);
  }

  const invitedUserId = inviteData.user?.id;

  if (!invitedUserId) {
    redirect("/leden?error=Uitnodiging%20kon%20niet%20worden%20aangemaakt.");
  }

  const { error } = await supabase.from("members").insert({
    user_id: invitedUserId,
    full_name: fullName,
    email,
    role: role === "beheerder" ? "beheerder" : "lid",
    is_active: true
  });

  if (error) {
    await supabase.auth.admin.deleteUser(invitedUserId);
    redirect(`/leden?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/leden");
  revalidatePath("/beheer");
  redirect("/leden?invited=1");
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
