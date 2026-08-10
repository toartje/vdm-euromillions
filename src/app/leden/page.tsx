import Link from "next/link";

import { addMember, deleteMember, updateMember } from "@/app/leden/actions";
import { MemberForm, type MemberFormValues } from "@/app/leden/member-form";
import { PageShell } from "@/components/page-shell";
import { requireViewer } from "@/lib/supabase/auth";

type LedenPageProps = {
  searchParams?: Promise<{
    added?: string;
    updated?: string;
    deleted?: string;
    error?: string;
    edit?: string;
  }>;
};

export default async function LedenPage({ searchParams }: LedenPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { supabase, member: viewerMember } = await requireViewer();
  const isAdmin = viewerMember.role === "beheerder";

  const { data: members, error } = isAdmin
    ? await supabase
        .from("members")
        .select("id, full_name, email, role, is_active, created_at")
        .order("created_at", { ascending: false })
    : { data: [viewerMember], error: null };

  if (error) {
    throw error;
  }

  const editMember = isAdmin
    ? members?.find((member) => member.id === resolvedSearchParams?.edit)
    : undefined;
  const editValues: MemberFormValues | undefined = editMember
    ? {
        id: editMember.id,
        full_name: editMember.full_name,
        email: editMember.email,
        role: editMember.role === "beheerder" ? "beheerder" : "lid",
        is_active: editMember.is_active
      }
    : undefined;

  return (
    <PageShell
      title="Ledenbeheer"
      subtitle="Een eenvoudig overzicht van de leden in jullie EuroMillions-groep."
    >
      {resolvedSearchParams?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      {resolvedSearchParams?.added === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Lid toegevoegd.
        </div>
      ) : null}

      {resolvedSearchParams?.updated === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Lid aangepast.
        </div>
      ) : null}

      {resolvedSearchParams?.deleted === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Lid verwijderd.
        </div>
      ) : null}

      {isAdmin ? (
        <MemberForm action={addMember} submitLabel="Lid toevoegen" />
      ) : null}

      {isAdmin && editValues ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Lid bewerken</p>
            <Link href="/leden" className="text-sm font-medium text-pool-700 hover:text-pool-800">
              Annuleren
            </Link>
          </div>
          <div className="mt-3">
            <MemberForm action={updateMember} submitLabel="Wijzigingen opslaan" values={editValues} />
          </div>
          <form action={deleteMember} className="mt-3">
            <input type="hidden" name="id" value={editValues.id} />
            <button
              type="submit"
              className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Lid verwijderen
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Ledenlijst</p>
        <div className="mt-3 space-y-3">
          {members?.length ? (
            members.map((member) => {
              const canEdit = isAdmin;
              const isSelf = member.id === viewerMember.id;

              return (
                <div key={member.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
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

                  {canEdit ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/leden?edit=${encodeURIComponent(member.id)}`}
                        className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Bewerken
                      </Link>
                      <form action={deleteMember}>
                        <input type="hidden" name="id" value={member.id} />
                        <button
                          type="submit"
                          disabled={isSelf}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSelf ? "Jezelf niet verwijderen" : "Verwijderen"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-600">Er staan nog geen leden in de database.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-pool-300 bg-pool-50 p-4 text-sm text-pool-900">
        <p className="font-semibold">{isAdmin ? "Volgende stap" : "Jouw account"}</p>
        <p className="mt-2">
          {isAdmin
            ? "In de volgende fase maken we hier ook aanpassen mogelijk."
            : "Je ziet hier alleen je eigen gegevens."}
        </p>
      </section>

      <Link
        href="/beheer"
        className="rounded-2xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
      >
        Terug naar beheer
      </Link>
    </PageShell>
  );
}
