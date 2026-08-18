import { PageShell } from "@/components/page-shell";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireViewer } from "@/lib/supabase/auth";
import { getMemberBalance } from "@/lib/supabase/balance";
import { createBalanceRequest } from "./actions";
import { SaldoActions } from "./saldo-actions";

type ProfielPageProps = {
  searchParams?: Promise<{
    requested?: string;
    amount?: string;
    error?: string;
  }>;
};

type BalanceLogEntry = {
  id: string;
  amount: number;
  createdAt: string;
  label: string;
  trekkingLabel?: string | null;
};

type BalanceAdjustmentRow = {
  id: string;
  amount: number | string;
  created_at: string;
  action_type: string | null;
  trekking_id?: string | null;
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function formatLogDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatSignedEuro(value: number) {
  const formatted = formatEuro(Math.abs(value));

  return value >= 0 ? `+ ${formatted}` : `- ${formatted}`;
}

function formatTrekkingLabel(weekday: string, drawDate: string) {
  const formattedDate = new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "long"
  }).format(new Date(`${drawDate}T00:00:00`));

  return `Trekking: ${weekday} ${formattedDate}`;
}

function getBalanceActionLabel(actionType: string | null) {
  switch (actionType?.toLowerCase() ?? "") {
    case "storten":
      return "Storten";
    case "uitbetalen":
      return "Uitbetalen";
    case "inschrijven_trekking":
    case "inschrijven":
    case "deelname":
    case "deelnames":
      return "Deelname";
    case "uitschrijven_trekking":
    case "uitschrijven":
      return "Uitschrijven";
    case "winst":
    case "winstverdeling":
      return "Winstverdeling";
    default:
      return null;
  }
}

function getFallbackBalanceActionLabel(adjustment: BalanceAdjustmentRow) {
  const amount = Number(adjustment.amount);

  if (amount < 0) {
    return Math.abs(amount) === 10 ? "Deelname" : "Uitbetalen";
  }

  if (amount === 10) {
    return "Uitschrijven";
  }

  return "Winstverdeling";
}

export default async function ProfielPage({ searchParams }: ProfielPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { member, user, supabase } = await requireViewer();
  const adminSupabase = createAdminClient();

  const [
    { count: totalMembers, error: totalMembersError },
    balance,
    { data: contributions, error: contributionsError },
    { data: balanceRequests, error: balanceRequestsError }
  ] = await Promise.all([
    adminSupabase.from("members").select("id", { count: "exact", head: true }),
    getMemberBalance(supabase, member.id),
    supabase
      .from("contributions")
      .select("id, amount, created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("balance_requests")
      .select("request_type, amount, status, created_at, handled_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
  ]);

  const balanceAdjustmentsQuery = await supabase
    .from("balance_adjustments")
    .select("id, amount, created_at, action_type, trekking_id")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false });

  const balanceAdjustments =
    balanceAdjustmentsQuery.error?.message?.includes("column") ||
    balanceAdjustmentsQuery.error?.message?.includes("relation") ||
    balanceAdjustmentsQuery.error?.message?.includes("constraint")
      ? (
          await supabase
            .from("balance_adjustments")
            .select("id, amount, created_at")
            .eq("member_id", member.id)
            .order("created_at", { ascending: false })
        ).data
      : balanceAdjustmentsQuery.data;

  const trekkingIds = Array.from(
    new Set(
      ((balanceAdjustments ?? []) as BalanceAdjustmentRow[])
        .map((adjustment) => adjustment.trekking_id)
        .filter((trekkingId): trekkingId is string => Boolean(trekkingId))
    )
  );

  const trekkingsById =
    trekkingIds.length > 0
      ? (await supabase.from("trekkings").select("id, draw_date, weekday").in("id", trekkingIds)).data ?? []
      : [];

  const trekkingLabelById = new Map(
    trekkingsById.map((trekking) => [
      trekking.id,
      formatTrekkingLabel(trekking.weekday, trekking.draw_date)
    ])
  );

  if (totalMembersError) {
    throw totalMembersError;
  }

  if (contributionsError) {
    throw contributionsError;
  }

  if (balanceAdjustmentsQuery.error && !balanceAdjustments) {
    throw balanceAdjustmentsQuery.error;
  }

  if (balanceRequestsError) {
    throw balanceRequestsError;
  }

  const openBalanceRequest = balanceRequests?.find((request) => request.status === "open") ?? null;

  const adjustmentLogEntries = ((balanceAdjustments ?? []) as BalanceAdjustmentRow[]).flatMap<BalanceLogEntry>(
    (adjustment) => {
      const label = getBalanceActionLabel(adjustment.action_type) ?? getFallbackBalanceActionLabel(adjustment);

      return [{
        id: `adjustment-${adjustment.id}`,
        amount: Number(adjustment.amount),
        createdAt: adjustment.created_at,
        label,
        trekkingLabel: adjustment.trekking_id ? trekkingLabelById.get(adjustment.trekking_id) ?? null : null
      }];
    }
  );

  const balanceLogEntries = [
    ...(contributions ?? []).map<BalanceLogEntry>((contribution) => ({
      id: `contribution-${contribution.id}`,
      amount: Number(contribution.amount),
      createdAt: contribution.created_at,
      label: "Storten"
    })),
    ...adjustmentLogEntries
  ]
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .slice(0, 5);

  const balanceRequestStatusMessage = resolvedSearchParams?.requested
    ? `Aanvraag verstuurd: ${resolvedSearchParams.requested === "storten" ? "geld storten" : "uitbetalen"}${
        resolvedSearchParams.amount ? ` voor ${formatEuro(Number(resolvedSearchParams.amount))}` : ""
      }.`
    : openBalanceRequest
      ? `Open verzoek: ${openBalanceRequest.request_type === "storten" ? "geld storten" : "uitbetalen"}${
          openBalanceRequest.amount != null ? ` voor ${formatEuro(Number(openBalanceRequest.amount))}` : ""
        }. Je kunt een nieuw verzoek pas doen nadat beheer dit heeft afgehandeld.`
      : "Je kunt hier geld storten of uitbetalen. Onder je saldo zie je de laatste saldoveranderingen.";

  return (
    <PageShell title="Profiel">
      {resolvedSearchParams?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Jouw profiel</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Naam</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{member.full_name}</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">E-mail</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {user.email ?? member.email ?? "Onbekend"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Rol</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {member.role === "beheerder" ? "Beheerder" : "Lid"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Toegang</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {member.is_active ? "Actief" : "Inactief"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Saldo</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Jouw saldo</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatEuro(balance)}</p>
            <p className="mt-2 text-sm text-slate-600">
              {openBalanceRequest
                ? `Open verzoek: ${openBalanceRequest.request_type === "storten" ? "geld storten" : "uitbetalen"}${
                    openBalanceRequest.amount != null ? ` voor ${formatEuro(Number(openBalanceRequest.amount))}` : ""
                  }.`
                : balanceRequestStatusMessage}
            </p>
          </div>
          <SaldoActions
            action={createBalanceRequest}
            disabled={Boolean(openBalanceRequest)}
            statusMessage={balanceRequestStatusMessage}
          />
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Saldoveranderingen</p>
          {balanceLogEntries.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {balanceLogEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2">
                  <span className="shrink-0 text-slate-400">-</span>
                  <span className="min-w-0">
                    <span className="font-medium text-slate-900">
                      {entry.label} {formatSignedEuro(entry.amount)}
                    </span>
                    <span className="block text-xs text-slate-500">{formatLogDate(entry.createdAt)}</span>
                    {entry.trekkingLabel ? (
                      <span className="block text-xs text-slate-500">{entry.trekkingLabel}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Nog geen saldoveranderingen.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Aantal leden</p>
        <p className="mt-3 text-4xl font-semibold text-slate-900">{totalMembers ?? 0}</p>
      </section>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
        >
          Uitloggen
        </button>
      </form>
    </PageShell>
  );
}
