"use client";

type SaldoActionsProps = {
  action: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
  statusMessage?: string | null;
};

export function SaldoActions({ action, disabled = false, statusMessage }: SaldoActionsProps) {
  return (
    <form action={action} className={`space-y-3 rounded-xl bg-slate-50 p-3 ${disabled ? "opacity-70" : ""}`}>
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-slate-500">Bedrag</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          disabled={disabled}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="request_type"
          value="storten"
          disabled={disabled}
          className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100"
        >
          Geld storten
        </button>

        <button
          type="submit"
          name="request_type"
          value="uitbetalen"
          disabled={disabled}
          className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100"
        >
          Uitbetalen
        </button>
      </div>

      <p className="text-xs text-slate-600">
        {statusMessage ?? "Vul eerst een bedrag in en kies daarna wat je wil doen."}
      </p>
    </form>
  );
}
