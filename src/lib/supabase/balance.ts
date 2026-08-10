import type { SupabaseClient } from "@supabase/supabase-js";

type BalanceRow = {
  amount: number | string;
};

export async function getMemberBalance(
  supabase: SupabaseClient,
  memberId: string
): Promise<number> {
  const [{ data: contributions, error: contributionsError }, { data: adjustments, error: adjustmentsError }] =
    await Promise.all([
      supabase.from("contributions").select("amount").eq("member_id", memberId),
      supabase.from("balance_adjustments").select("amount").eq("member_id", memberId)
    ]);

  if (contributionsError) {
    throw contributionsError;
  }

  if (adjustmentsError) {
    throw adjustmentsError;
  }

  const totalContributions =
    (contributions as BalanceRow[] | null)?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;
  const totalAdjustments =
    (adjustments as BalanceRow[] | null)?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;

  return totalContributions + totalAdjustments;
}
