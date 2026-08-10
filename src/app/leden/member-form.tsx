"use client";

import { useFormStatus } from "react-dom";

export type MemberFormValues = {
  id?: string;
  full_name?: string;
  email?: string | null;
  role?: "lid" | "beheerder";
  is_active?: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-pool-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pool-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Bezig..." : label}
    </button>
  );
}

type MemberFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  values?: MemberFormValues;
};

export function MemberForm({ action, submitLabel, values }: MemberFormProps) {
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-slate-900">
          Naam
        </label>
        <input
          id="full_name"
          name="full_name"
          defaultValue={values?.full_name ?? ""}
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
          placeholder="Voornaam Achternaam"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-900">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={values?.email ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
          placeholder="naam@voorbeeld.be"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-slate-900">
          Rol
        </label>
        <select
          id="role"
          name="role"
          defaultValue={values?.role ?? "lid"}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
        >
          <option value="lid">Lid</option>
          <option value="beheerder">Beheerder</option>
        </select>
      </div>

      {values?.id ? (
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={values.is_active ?? true}
            className="h-4 w-4 rounded border-slate-300 text-pool-700 focus:ring-pool-400"
          />
          Actief
          <input type="hidden" name="is_active" value="false" />
        </label>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
