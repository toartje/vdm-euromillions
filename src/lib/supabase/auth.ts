import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ViewerMember = {
  id: string;
  full_name: string;
  email: string | null;
  role: "beheerder" | "lid";
  is_active: boolean;
};

export async function requireViewer() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("id, full_name, email, role, is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!member) {
    redirect("/login?error=Je%20account%20is%20nog%20niet%20gekoppeld");
  }

  return {
    supabase,
    user: authData.user,
    member: member as ViewerMember
  };
}

export async function requireAdmin() {
  const viewer = await requireViewer();

  if (viewer.member.role !== "beheerder") {
    redirect("/leden");
  }

  return viewer;
}
