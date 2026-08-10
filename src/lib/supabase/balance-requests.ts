import type { SupabaseClient } from "@supabase/supabase-js";

export type BalanceRequestRow = {
  id: string;
  member_id: string;
  request_type: "storten" | "uitbetalen";
  amount: number | string | null;
  status: "open" | "afgehandeld";
  created_at: string;
  handled_at: string | null;
};

const BALANCE_REQUEST_COLUMNS = "id, member_id, request_type, amount, status, created_at, handled_at";

export async function getMemberBalanceRequests(supabase: SupabaseClient, memberId: string) {
  const { data, error } = await supabase
    .from("balance_requests")
    .select(BALANCE_REQUEST_COLUMNS)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []) as BalanceRequestRow[];
}

export async function getOpenMemberBalanceRequest(supabase: SupabaseClient, memberId: string) {
  const { data, error } = await supabase
    .from("balance_requests")
    .select(BALANCE_REQUEST_COLUMNS)
    .eq("member_id", memberId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as BalanceRequestRow | null;
}
