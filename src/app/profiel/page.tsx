import Link from "next/link";

import { createBalanceRequest } from "@/app/profiel/actions";
import { PageShell } from "@/components/page-shell";
import { getMemberBalanceRequests, type BalanceRequestRow } from "@/lib/supabase/balance-requests";
import { requireViewer } from "@/lib/supabase/auth";
import { SaldoActions } from "./saldo-actions";

type ProfielPageProps = {
  searchParams?: Promise<{
    requested?: string;
    amount?: string;
    error?: string;
  }>;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Onbekend";
  }

  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR"
  }).format(amount);
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

export default async function ProfielPage({ searchParams }: ProfielPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { member, user, supabase } = await requireViewer();
  const isAdmin = member.role === "beheerder";

  const [
    { data: members },
    { data: contributions },
    { data: balanceAdjustments, error: balanceAdjustmentsError }
  ] = await Promise.all([
    supabase.from("members").select("id, is_active"),
    supabase.from("contributions").select("member_id, amount, contribution_date"),
    supabase.from("balance_adjustments").select("member_id, amount")
  ]);

  const balanceRequests = await getMemberBalanceRequests(supabase, member.id);

  const totalMembers = members?.length ?? 0;
  const activeMembers = members?.filter((item) => item.is_active).length ?? 0;
  const effectiveAdjustments = isMissingBalanceAdjustmentsTableError(balanceAdjustmentsError)
    ? []
    : balanceAdjustments ?? [];
  const memberBalanceRequests = (balanceRequests ?? []) as BalanceRequestRow[];
  const ownContributions = contributions?.filter((item) => item.member_id === member.id) ?? [];
  const ownAdjustments = effectiveAdjustments.filter((item) => item.member_id === member.id);
  const openBalanceRequest = memberBalanceRequests.find((request) => request.status === "open") ?? null;
  const latestBalanceRequest = memberBalanceRequests[0] ?? null;
  const ownBalance =
    ownContributions.reduce((sum, item) => sum + Number(item.amount), 0) +
    ownAdjustments.reduce((sum, item) => sum + Number(item.amount), 0);
  const lastContributionDate = ownContributions[0]?.contribution_date ?? null;
  const balanceRequestStatusMessage = openBalanceRequest
    ? `Open verzoek: ${openBalanceRequest.request_type === "storten" ? "geld storten" : "uitbetalen"}${openBalanceRequest.amount != null ? ` voor ${formatEuro(Number(openBalanceRequest.amount))}` : ""}. Je kunt een nieuw verzoek pas doen nadat beheer dit heeft afgehandeld.`
    : latestBalanceRequest
      ? `Laatste verzoek: ${latestBalanceRequest.request_type === "storten" ? "geld storten" : "uitbetalen"}${latestBalanceRequest.amount != null ? ` voor ${formatEuro(Number(latestBalanceRequest.amount))}` : ""} is afgehandeld.`
      : "Nog geen saldoverzoeken gedaan.";

  return (
    <PageShell title="Profiel" subtitle="Jouw account, toegang en snelle acties.">
      {resolvedSearchParams?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      {resolvedSearchParams?.requested ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Melding verstuurd: {resolvedSearchParams.requested === "storten" ? "geld storten" : "uitbetalen"}
          {resolvedSearchParams.amount ? ` voor ${formatEuro(Number(resolvedSearchParams.amount))}` : ""}.
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
              {isAdmin ? "Beheerder" : "Lid"}
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

      <section id="saldo" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Saldo</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Jouw saldo</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatEuro(ownBalance)}</p>
          </div>
          <SaldoActions
            action={createBalanceRequest}
            disabled={Boolean(openBalanceRequest)}
            statusMessage={balanceRequestStatusMessage}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Actieve leden</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {activeMembers} / {totalMembers}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Laatste bijdrage</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {lastContributionDate ? formatDate(lastContributionDate) : "Nog geen bijdragen ingevoerd"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Dit is jouw persoonlijke saldo. In beheer zie je het totaal en kun je saldi per lid
          handmatig aanpassen.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Accountinformatie</p>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>Supabase account aangemaakt op: {formatDate(user.created_at)}</p>
          <p>Laatste login: {formatDate(user.last_sign_in_at)}</p>
          <p>Status in LuckyPool: {member.is_active ? "Toegang actief" : "Toegang geblokkeerd"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-pool-300 bg-pool-50 p-4 text-sm text-pool-900">
        <p className="font-semibold">Invite-only</p>
        <p className="mt-2">
          Alleen uitgenodigde leden krijgen toegang. Nieuwe leden voeg je toe via de ledenpagina.
        </p>
      </section>

      <section className="grid gap-3">
        <Link
          href="/leden"
          className="rounded-2xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
        >
          Naar ledenbeheer
        </Link>

        {isAdmin ? (
          <Link
            href="/beheer"
            className="rounded-2xl border border-dashed border-pool-300 bg-pool-50 p-4 text-sm font-medium text-pool-800 transition hover:bg-pool-100"
          >
            Naar beheer
          </Link>
        ) : null}
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
