import Link from "next/link";

import { adjustMemberBalance, markBalanceRequestHandled } from "@/app/beheer/actions";
import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/supabase/auth";

function euro(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR"
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTrekkingDay(date: Date) {
  return date.getDay() === 2 || date.getDay() === 5;
}

function getNextTrekkingDate(from = new Date()) {
  const start = new Date(from);
  start.setHours(12, 0, 0, 0);

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);

    if (isTrekkingDay(candidate)) {
      return candidate;
    }
  }

  return start;
}

function getWeekdayLabel(date: Date) {
  return date.getDay() === 2 ? "dinsdag" : "vrijdag";
}

function isMissingBalanceAdjustmentsTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "42P01" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes('"public.balance_adjustments"')
  );
}

type BeheerPageProps = {
  searchParams?: Promise<{
    handled?: string;
    adjusted?: string;
    error?: string;
  }>;
};

type TrekkingRow = {
  id: string;
  draw_date: string;
  weekday: "dinsdag" | "vrijdag";
  status: "open" | "gesloten" | "resultaat_ingevuld" | "verwerkt";
};

type TrekkingParticipationRow = {
  member_id: string;
  is_playing: boolean;
};

type MemberRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: "beheerder" | "lid";
  is_active: boolean;
  created_at: string;
};

export default async function BeheerPage({ searchParams }: BeheerPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { supabase } = await requireAdmin();
  const nextTrekkingDate = getNextTrekkingDate();
  const nextTrekkingDateKey = toDateKey(nextTrekkingDate);

  const [
    { data: members, error: membersError },
    { data: contributions, error: contributionsError },
    { data: balanceRequests, error: balanceRequestsError },
    { data: balanceAdjustments, error: balanceAdjustmentsError },
    { data: nextTrekking, error: nextTrekkingError }
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id, full_name, email, role, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("contributions")
      .select("id, member_id, amount, contribution_date, note, created_at")
      .order("contribution_date", { ascending: false }),
    supabase
      .from("balance_requests")
      .select("id, member_id, request_type, amount, status, created_at, handled_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("balance_adjustments")
      .select("id, member_id, amount, created_at, created_by")
      .order("created_at", { ascending: false }),
    supabase
      .from("trekkings")
      .select("id, draw_date, weekday, status")
      .eq("draw_date", nextTrekkingDateKey)
      .maybeSingle()
  ]);

  if (membersError || contributionsError || balanceRequestsError || nextTrekkingError) {
    throw membersError ?? contributionsError ?? balanceRequestsError ?? nextTrekkingError;
  }

  const memberById = new Map((members ?? []).map((member) => [member.id, member as MemberRow]));
  const openRequests = balanceRequests?.filter((request) => request.status === "open") ?? [];
  const contributionsByMember = new Map<string, number>();
  for (const contribution of contributions ?? []) {
    contributionsByMember.set(
      contribution.member_id,
      (contributionsByMember.get(contribution.member_id) ?? 0) + Number(contribution.amount)
    );
  }

  const adjustmentsByMember = new Map<string, number>();
  const effectiveAdjustments = isMissingBalanceAdjustmentsTableError(balanceAdjustmentsError)
    ? []
    : balanceAdjustments ?? [];

  for (const adjustment of effectiveAdjustments) {
    adjustmentsByMember.set(
      adjustment.member_id,
      (adjustmentsByMember.get(adjustment.member_id) ?? 0) + Number(adjustment.amount)
    );
  }

  const nextTrekkingRow = (nextTrekking ?? null) as TrekkingRow | null;
  const { data: nextTrekkingParticipations, error: nextTrekkingParticipationsError } = nextTrekkingRow
    ? await supabase
        .from("trekking_participations")
        .select("member_id, is_playing")
        .eq("trekking_id", nextTrekkingRow.id)
        .eq("is_playing", true)
    : { data: [], error: null };

  if (nextTrekkingParticipationsError) {
    throw nextTrekkingParticipationsError;
  }

  const nextTrekkingParticipants = ((nextTrekkingParticipations ?? []) as TrekkingParticipationRow[])
    .map((participation) => memberById.get(participation.member_id))
    .filter(Boolean) as MemberRow[];

  const balanceByMember = new Map<string, number>();
  for (const member of members ?? []) {
    balanceByMember.set(
      member.id,
      (contributionsByMember.get(member.id) ?? 0) + (adjustmentsByMember.get(member.id) ?? 0)
    );
  }

  const totalBalance = Array.from(balanceByMember.values()).reduce((sum, amount) => sum + amount, 0);
  const nextTrekkingLabel = `${formatDate(nextTrekkingDateKey)} (${getWeekdayLabel(nextTrekkingDate)})`;
  const nextTrekkingParticipantLabel = `${nextTrekkingParticipants.length} ${
    nextTrekkingParticipants.length === 1 ? "lid" : "leden"
  } spelen mee.`;

  return (
    <PageShell title="Beheer" subtitle="Hier zie je nu al de eerste data uit Supabase.">
      {resolvedSearchParams?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      {resolvedSearchParams?.handled === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Verzoek afgehandeld.
        </div>
      ) : null}

      {resolvedSearchParams?.adjusted === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Saldo aangepast.
        </div>
      ) : null}

      {isMissingBalanceAdjustmentsTableError(balanceAdjustmentsError) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          De saldo-historiek verschijnt zodra de bijgewerkte Supabase SQL ook is uitgevoerd.
        </div>
      ) : null}

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
        <p className="text-sm font-semibold text-sky-900">Melding voor spelers</p>
        <p className="mt-1 text-sm text-sky-800">Volgende trekking: {nextTrekkingLabel}</p>
        <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-sky-100">
          <p className="text-sm font-medium text-slate-900">
            {nextTrekkingParticipants.length
              ? nextTrekkingParticipantLabel
              : "Nog geen leden hebben zich aangemeld voor deze trekking."}
          </p>
          {nextTrekkingParticipants.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextTrekkingParticipants.map((participant) => (
                <span
                  key={participant.id}
                  className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800"
                >
                  {participant.full_name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Open meldingen</p>
        <p className="mt-1 text-sm text-slate-600">
          Meldingen van leden over geld storten of uitbetalen.
        </p>
        <div className="mt-3 space-y-3">
          {openRequests.length ? (
            openRequests.map((request) => {
              const member = memberById.get(request.member_id);

              return (
                <div key={request.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{member?.full_name ?? "Onbekend lid"}</p>
                      <p className="text-xs text-slate-500">
                        {member?.email ?? "Geen e-mail"} ·{" "}
                        {request.request_type === "storten" ? "Geld storten" : "Uitbetalen"} ·{" "}
                        {euro(Number(request.amount ?? 0))}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      Open
                    </span>
                  </div>

                  <form action={markBalanceRequestHandled} className="mt-3">
                    <input type="hidden" name="id" value={request.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Afhandelen
                    </button>
                  </form>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-600">Er zijn nog geen open meldingen.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Leden</p>
        <div className="mt-3 space-y-3">
          {members?.length ? (
            members.map((member) => {
              const currentBalance = balanceByMember.get(member.id) ?? 0;

              return (
                <div key={member.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{member.full_name}</p>
                      <p className="text-xs text-slate-500">
                        {member.email ?? "Geen e-mail"} · {member.role}
                      </p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-xs font-medium",
                        member.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                      ].join(" ")}
                    >
                      {member.is_active ? "Actief" : "Inactief"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-600">Huidig saldo</span>
                      <span className="text-lg font-semibold text-slate-900">{euro(currentBalance)}</span>
                    </div>

                    <form action={adjustMemberBalance} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <input type="hidden" name="member_id" value={member.id} />
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Bedrag"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
                      />
                      <button
                        type="submit"
                        name="direction"
                        value="plus"
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Verhogen
                      </button>
                      <button
                        type="submit"
                        name="direction"
                        value="minus"
                        className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                      >
                        Verlagen
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-600">Er staan nog geen leden in de database.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Overzicht</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500">Leden</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{members?.length ?? 0}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500">Totaal saldo</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{euro(totalBalance)}</p>
          </div>
        </div>
      </section>

      <Link
        href="/leden"
        className="rounded-2xl border border-dashed border-pool-300 bg-pool-50 p-4 text-sm font-medium text-pool-800 transition hover:bg-pool-100"
      >
        Open ledenbeheer
      </Link>
    </PageShell>
  );
}
