"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient, getSiteUrl } from "@/lib/supabase/admin";

function isDuplicateEmailError(error: { message?: string | null; code?: string | null } | null) {
  const message = error?.message ?? "";
  return error?.code === "23505" || message.includes("members_email_unique");
}

function isAlreadyRegisteredAuthError(error: { message?: string | null } | null) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("already been registered");
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    return { error, user: null };
  }

  const user = data.users.find((candidate) => (candidate.email ?? "").trim().toLowerCase() === email) ?? null;
  return { error: null, user };
}

export async function addMember(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw.length > 0 ? emailRaw : null;
  const role = String(formData.get("role") ?? "lid");

  if (!fullName) {
    redirect("/leden?error=Vul%20een%20naam%20in.");
  }

  if (!email) {
    redirect("/leden?error=Vul%20een%20e-mail%20in.");
  }

  const supabase = createAdminClient();

  const { data: existingMember, error: existingMemberError } = await supabase
    .from("members")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingMemberError) {
    redirect(`/leden?error=${encodeURIComponent(existingMemberError.message)}`);
  }

  if (existingMember) {
    redirect("/leden?error=Dit%20e-mailadres%20bestaat%20al%20in%20de%20ledenlijst.");
  }

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/setup-password`;

  let invitedUserId: string | null = null;
  let reuseExistingAuthUser = false;

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo
  });

  if (inviteError) {
    if (!isAlreadyRegisteredAuthError(inviteError)) {
      redirect(`/leden?error=${encodeURIComponent(inviteError.message)}`);
    }

    const { error: authLookupError, user: existingAuthUser } = await findAuthUserByEmail(supabase, email);

    if (authLookupError) {
      redirect(`/leden?error=${encodeURIComponent(authLookupError.message)}`);
    }

    if (!existingAuthUser?.id) {
      redirect(
        "/leden?error=Er%20bestaat%20al%20een%20account%20voor%20dit%20e-mailadres.%20Verwijder%20dat%20account%20in%20Supabase%20of%20gebruik%20een%20ander%20e-mailadres."
      );
    }

    invitedUserId = existingAuthUser.id;
    reuseExistingAuthUser = true;
  } else {
    invitedUserId = inviteData.user?.id ?? null;
  }

  if (!invitedUserId) {
    redirect("/leden?error=Uitnodiging%20kon%20niet%20worden%20aangemaakt.");
  }

  const memberPayload = {
    user_id: invitedUserId,
    full_name: fullName,
    email,
    role: role === "beheerder" ? "beheerder" : "lid",
    is_active: true
  };

  if (reuseExistingAuthUser) {
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (recoveryError) {
      redirect(`/leden?error=${encodeURIComponent(recoveryError.message)}`);
    }
  }

  const { data: existingMemberAfterInvite, error: existingMemberAfterInviteError } = await supabase
    .from("members")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingMemberAfterInviteError) {
    await supabase.auth.admin.deleteUser(invitedUserId);
    redirect(`/leden?error=${encodeURIComponent(existingMemberAfterInviteError.message)}`);
  }

  if (existingMemberAfterInvite) {
    const { error: updateError } = await supabase.from("members").update(memberPayload).eq("id", existingMemberAfterInvite.id);

    if (updateError) {
      await supabase.auth.admin.deleteUser(invitedUserId);
      redirect(`/leden?error=${encodeURIComponent(updateError.message)}`);
    }

    revalidatePath("/leden");
    revalidatePath("/beheer");
    redirect("/leden?invited=1");
  }

  const { error: insertError } = await supabase.from("members").insert(memberPayload);

  if (insertError) {
    if (isDuplicateEmailError(insertError)) {
      const { data: conflictedMember, error: conflictedMemberError } = await supabase
        .from("members")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (conflictedMemberError) {
        await supabase.auth.admin.deleteUser(invitedUserId);
        redirect(`/leden?error=${encodeURIComponent(conflictedMemberError.message)}`);
      }

      if (conflictedMember) {
        const { error: updateError } = await supabase.from("members").update(memberPayload).eq("id", conflictedMember.id);

        if (updateError) {
          await supabase.auth.admin.deleteUser(invitedUserId);
          redirect(`/leden?error=${encodeURIComponent(updateError.message)}`);
        }

        revalidatePath("/leden");
        revalidatePath("/beheer");
        redirect("/leden?invited=1");
      }
    }

    await supabase.auth.admin.deleteUser(invitedUserId);
    redirect(`/leden?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/leden");
  revalidatePath("/beheer");
  redirect("/leden?invited=1");
}

export async function updateMember(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw.length > 0 ? emailRaw : null;
  const role = String(formData.get("role") ?? "lid");
  const isActive = String(formData.get("is_active") ?? "true") === "true";

  if (!id) {
    redirect("/leden?error=Ontbrekend%20lid.");
  }

  if (!fullName) {
    redirect("/leden?error=Vul%20een%20naam%20in.");
  }

  const supabase = createAdminClient();

  if (email) {
    const { data: existingMember, error: existingMemberError } = await supabase
      .from("members")
      .select("id")
      .eq("email", email)
      .neq("id", id)
      .maybeSingle();

    if (existingMemberError) {
      redirect(`/leden?error=${encodeURIComponent(existingMemberError.message)}`);
    }

    if (existingMember) {
      redirect("/leden?error=Dit%20e-mailadres%20bestaat%20al%20in%20de%20ledenlijst.");
    }
  }

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
    if (isDuplicateEmailError(error)) {
      redirect("/leden?error=Dit%20e-mailadres%20bestaat%20al%20in%20de%20ledenlijst.");
    }

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

  const supabase = createAdminClient();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id,user_id,email")
    .eq("id", id)
    .maybeSingle();

  if (memberError) {
    redirect(`/leden?error=${encodeURIComponent(memberError.message)}`);
  }

  if (!member) {
    redirect("/leden?error=Ontbrekend%20lid.");
  }

  if (member.user_id) {
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(member.user_id);

    if (authDeleteError) {
      redirect(`/leden?error=${encodeURIComponent(authDeleteError.message)}`);
    }
  }

  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) {
    redirect(`/leden?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/leden");
  revalidatePath("/beheer");
  redirect("/leden?deleted=1");
}
