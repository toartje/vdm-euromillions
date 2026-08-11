import Link from "next/link";

import {
  closeTrekking,
  saveTrekkingResult,
  setTrekkingParticipation,
  resetTrekking,
  reopenTrekking
} from "@/app/trekkingen/actions";
import { PageShell } from "@/components/page-shell";
import { ImageLightboxCard } from "@/components/image-lightbox-card";
import { requireViewer } from "@/lib/supabase/auth";
import { TrekkingPhotoForm } from "@/app/trekkingen/trekking-photo-form";

type TrekkingenPageProps = {
  searchParams?: Promise<{
    date?: string;
    joined?: string;
    left?: string;
    photos?: string;
    closed?: string;
    reopened?: string;
    reset?: string;
    result?: string;
    distributed?: string;
    error?: string;
  }>;
};

type TrekkingRow = {
  id: string;
  draw_date: string;
  weekday: "dinsdag" | "vrijdag";
  status: "open" | "gesloten" | "resultaat_ingevuld" | "verwerkt";
  winning_numbers: number[] | null;
  winning_stars: number[] | null;
  total_prize: number | string | null;
  bought_ticket_image_url: string | null;
  payout_ticket_image_url: string | null;
};

type ParticipationRow = {
  member_id: string;
  is_playing: boolean;
  joined_at: string;
  left_at: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR"
  }).format(amount);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function getAdjacentTrekkingDate(date: Date, direction: 1 | -1) {
  const start = new Date(date);
  start.setHours(12, 0, 0, 0);

  for (let offset = 1; offset < 8; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset * direction);

    if (isTrekkingDay(candidate)) {
      return candidate;
    }
  }

  return start;
}

function getWeekdayLabel(date: Date) {
  return date.getDay() === 2 ? "dinsdag" : "vrijdag";
}

function getStatusLabel(status?: TrekkingRow["status"] | null) {
  switch (status) {
    case "gesloten":
      return "Gesloten";
    case "resultaat_ingevuld":
      return "Resultaat ingevuld";
    case "verwerkt":
      return "Verwerkt";
    default:
      return "Open";
  }
}

function formatWinningNumbers(numbers: number[] | null | undefined) {
  if (!numbers?.length) {
    return "Nog niet ingevuld";
  }

  return numbers.join(", ");
}

function formatWinningStars(stars: number[] | null | undefined) {
  if (!stars?.length) {
    return "Nog niet ingevuld";
  }

  return stars.join(", ");
}

export default async function TrekkingenPage({ searchParams }: TrekkingenPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { member, supabase } = await requireViewer();
  const isAdmin = member.role === "beheerder";

  const requestedDate = parseDateKey(resolvedSearchParams?.date);
  const selectedDate = requestedDate && isTrekkingDay(requestedDate) ? requestedDate : getNextTrekkingDate();
  const selectedDateKey = toDateKey(selectedDate);
  const previousDate = getAdjacentTrekkingDate(selectedDate, -1);
  const nextDate = getAdjacentTrekkingDate(selectedDate, 1);
  const weekdayLabel = getWeekdayLabel(selectedDate);

  const { data: trekkingRow, error: trekkingError } = await supabase
    .from("trekkings")
    .select(
      "id, draw_date, weekday, status, winning_numbers, winning_stars, total_prize, bought_ticket_image_url, payout_ticket_image_url"
    )
    .eq("draw_date", selectedDateKey)
    .maybeSingle();

  if (trekkingError) {
    throw trekkingError;
  }

  const trekking = trekkingRow as TrekkingRow | null;

  const { data: participations, error: participationsError } = trekking
    ? await supabase
        .from("trekking_participations")
        .select("member_id, is_playing, joined_at, left_at")
        .eq("trekking_id", trekking.id)
    : { data: [], error: null };

  if (participationsError) {
    throw participationsError;
  }

  const participationRows = (participations ?? []) as ParticipationRow[];
  const participationByMemberId = new Map(participationRows.map((row) => [row.member_id, row]));
  const myParticipation = participationByMemberId.get(member.id);
  const playingCount = participationRows.filter((row) => row.is_playing).length;
  const participationLocked = (trekking?.status ?? "open") !== "open";

  const currentPrize = trekking?.total_prize == null ? null : Number(trekking.total_prize);
  const boughtTicketImageUrl = trekking?.bought_ticket_image_url ?? "";
  const payoutTicketImageUrl = trekking?.payout_ticket_image_url ?? "";
  const hasWinningNumbers = (trekking?.winning_numbers?.length ?? 0) === 5;
  const hasWinningStars = (trekking?.winning_stars?.length ?? 0) === 2;
  const canEnterPrize = hasWinningNumbers && hasWinningStars;

  return (
    <PageShell
      title="Trekkingen"
      subtitle="Hier zie je de volgende trekking en kan je je deelname aan of uit zetten."
    >
      {resolvedSearchParams?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      {resolvedSearchParams?.photos === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Foto&apos;s opgeslagen.
        </div>
      ) : null}

      {resolvedSearchParams?.closed === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Trekking gesloten.
        </div>
      ) : null}

      {resolvedSearchParams?.reopened === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Trekking opnieuw geopend.
        </div>
      ) : null}

      {resolvedSearchParams?.reset === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Trekking teruggezet en opnieuw geopend.
        </div>
      ) : null}

      {resolvedSearchParams?.result === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Resultaat opgeslagen.
        </div>
      ) : null}

      {resolvedSearchParams?.distributed === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Winst is verdeeld over de deelnemende leden.
        </div>
      ) : null}

      <section className="rounded-3xl bg-gradient-to-br from-pool-600 to-sky-700 p-5 text-white shadow-soft">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-pool-100">Volgende trekking</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href={`/trekkingen?date=${toDateKey(previousDate)}`}
            className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            ← Vorige
          </Link>
          <div className="text-center">
            <h2 className="text-xl font-bold sm:text-2xl">{formatDate(selectedDateKey)}</h2>
            <p className="mt-1 text-sm text-sky-50/90">
              Trekking op {weekdayLabel}. Elke deelname kost € 10,00.
            </p>
          </div>
          <Link
            href={`/trekkingen?date=${toDateKey(nextDate)}`}
            className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Volgende →
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Trekkinginformatie</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{getStatusLabel(trekking?.status)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Deelnemers</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{playingCount} actief</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Winnende nummers</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{formatWinningNumbers(trekking?.winning_numbers)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sterren</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{formatWinningStars(trekking?.winning_stars)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Totale winst</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {currentPrize == null ? "Nog niet ingevuld" : formatEuro(currentPrize)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Trekkingfoto&apos;s</p>
        <p className="mt-1 text-sm text-slate-600">
          Hier zie je de foto van de aangekochte lotjes en de foto van de lotjes bij uitbetaling. Deze foto&apos;s zijn
          zichtbaar voor alle leden.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ImageLightboxCard
            title="Aangekochte lotjes"
            imageUrl={trekking?.bought_ticket_image_url}
            emptyLabel="Nog geen foto toegevoegd."
          />
          <ImageLightboxCard
            title="Lotjes bij uitbetaling"
            imageUrl={trekking?.payout_ticket_image_url}
            emptyLabel="Nog geen foto toegevoegd."
          />
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-900">Beheer: trekking sluiten</p>
          <p className="mt-1 text-sm text-slate-600">
            Gebruik dit om inschrijvingen af te sluiten. Leden kunnen daarna hun deelname niet meer aanpassen.
          </p>

          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Huidige status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{getStatusLabel(trekking?.status)}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {participationLocked ? (
                trekking?.status === "verwerkt" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                    Deze trekking is verwerkt. Gebruik reset om opnieuw te beginnen.
                  </div>
                ) : (
                  <form action={reopenTrekking} className="w-full">
                    <input type="hidden" name="draw_date" value={selectedDateKey} />
                    <input type="hidden" name="weekday" value={weekdayLabel} />
                    <button
                      type="submit"
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      Trekking heropenen
                    </button>
                  </form>
                )
              ) : (
                <form action={closeTrekking} className="w-full">
                  <input type="hidden" name="draw_date" value={selectedDateKey} />
                  <input type="hidden" name="weekday" value={weekdayLabel} />
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Trekking sluiten
                  </button>
                </form>
              )}

              <form action={resetTrekking} className="w-full">
                <input type="hidden" name="draw_date" value={selectedDateKey} />
                <input type="hidden" name="weekday" value={weekdayLabel} />
                <button
                  type="submit"
                  className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                >
                  Trekking resetten
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-900">Jouw deelname</p>
        <p className="mt-2 text-sm text-slate-600">
          Klik om aan te geven of je meedoet aan deze trekking. Bij meedoen wordt automatisch € 10,00 van je saldo
          gehaald.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {participationLocked ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Deze trekking is gesloten.
            </div>
          ) : myParticipation?.is_playing ? (
            <form action={setTrekkingParticipation}>
              <input type="hidden" name="draw_date" value={selectedDateKey} />
              <input type="hidden" name="weekday" value={weekdayLabel} />
              <input type="hidden" name="is_playing" value="false" />
              <button
                type="submit"
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Ik speel niet mee
              </button>
            </form>
          ) : (
            <form action={setTrekkingParticipation}>
              <input type="hidden" name="draw_date" value={selectedDateKey} />
              <input type="hidden" name="weekday" value={weekdayLabel} />
              <input type="hidden" name="is_playing" value="true" />
              <button
                type="submit"
                className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Ik speel mee
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-900">
            Status: {myParticipation?.is_playing ? "Je speelt mee." : "Je speelt nog niet mee."}
          </p>
          <p className="mt-1">
            Er wordt automatisch een saldo-aanpassing van € 10,00 gemaakt bij inschrijving of uitschrijving.
          </p>
        </div>
      </section>

      {isAdmin ? (
        <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <TrekkingPhotoForm
            drawDate={selectedDateKey}
            weekday={weekdayLabel}
            boughtTicketImageUrl={trekking?.bought_ticket_image_url}
            payoutTicketImageUrl={trekking?.payout_ticket_image_url}
          />

          <div>
            <p className="text-sm font-semibold text-slate-900">Beheer: trekkingresultaat</p>
            <p className="mt-1 text-sm text-slate-600">
              Vul eerst de 5 winnende nummers en 2 sterren in. De totale winst kan later apart worden opgeslagen en
              daarna verdeeld worden over de actieve deelnemers.
            </p>

            <form action={saveTrekkingResult} className="mt-3 space-y-4">
              <input type="hidden" name="draw_date" value={selectedDateKey} />
              <input type="hidden" name="weekday" value={weekdayLabel} />
              <input type="hidden" name="bought_ticket_image_url" value={boughtTicketImageUrl} />
              <input type="hidden" name="payout_ticket_image_url" value={payoutTicketImageUrl} />
              <input type="hidden" name="total_prize" value={currentPrize == null ? "" : String(currentPrize)} />

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Winnende nummers</p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }, (_, index) => (
                    <input
                      key={`winning_number_${index + 1}`}
                      name={`winning_number_${index + 1}`}
                      type="number"
                      min="1"
                      max="50"
                      defaultValue={trekking?.winning_numbers?.[index] ? String(trekking.winning_numbers[index]) : ""}
                      placeholder={`${index + 1}`}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sterren</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Array.from({ length: 2 }, (_, index) => (
                    <input
                      key={`winning_star_${index + 1}`}
                      name={`winning_star_${index + 1}`}
                      type="number"
                      min="1"
                      max="12"
                      defaultValue={trekking?.winning_stars?.[index] ? String(trekking.winning_stars[index]) : ""}
                      placeholder={`${index + 1}`}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="rounded-full bg-pool-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pool-700"
              >
                Nummers en sterren opslaan
              </button>
            </form>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Totale winst opslaan</p>
              <p className="mt-1 text-sm text-slate-600">
                Zodra je het winstbedrag kent, kan je het hier apart invullen. Daarna kan je kiezen om de winst
                meteen te verdelen.
              </p>

              {canEnterPrize ? (
                <form action={saveTrekkingResult} className="mt-3 space-y-4">
                  <input type="hidden" name="draw_date" value={selectedDateKey} />
                  <input type="hidden" name="weekday" value={weekdayLabel} />
                  <input type="hidden" name="bought_ticket_image_url" value={boughtTicketImageUrl} />
                  <input type="hidden" name="payout_ticket_image_url" value={payoutTicketImageUrl} />
                  <input
                    type="hidden"
                    name="winning_number_1"
                    value={trekking?.winning_numbers?.[0] ? String(trekking.winning_numbers[0]) : ""}
                  />
                  <input
                    type="hidden"
                    name="winning_number_2"
                    value={trekking?.winning_numbers?.[1] ? String(trekking.winning_numbers[1]) : ""}
                  />
                  <input
                    type="hidden"
                    name="winning_number_3"
                    value={trekking?.winning_numbers?.[2] ? String(trekking.winning_numbers[2]) : ""}
                  />
                  <input
                    type="hidden"
                    name="winning_number_4"
                    value={trekking?.winning_numbers?.[3] ? String(trekking.winning_numbers[3]) : ""}
                  />
                  <input
                    type="hidden"
                    name="winning_number_5"
                    value={trekking?.winning_numbers?.[4] ? String(trekking.winning_numbers[4]) : ""}
                  />
                  <input
                    type="hidden"
                    name="winning_star_1"
                    value={trekking?.winning_stars?.[0] ? String(trekking.winning_stars[0]) : ""}
                  />
                  <input
                    type="hidden"
                    name="winning_star_2"
                    value={trekking?.winning_stars?.[1] ? String(trekking.winning_stars[1]) : ""}
                  />

                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Totale winst</span>
                    <input
                      name="total_prize"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={currentPrize == null ? "" : String(currentPrize)}
                      placeholder="0,00"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pool-400 focus:ring-2 focus:ring-pool-100"
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                    <input
                      type="checkbox"
                      name="distribute_winnings"
                      value="true"
                      defaultChecked
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-pool-600"
                    />
                    <span>
                      Winst direct verdelen over de actieve deelnemers. Dit werkt voorlopig nog gelijkmatig verdeeld
                      per speler.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="rounded-full bg-pool-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pool-700"
                  >
                    Winst opslaan
                  </button>
                </form>
              ) : (
                <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                  Eerst de winnende nummers en sterren opslaan, daarna kan je het winstbedrag invullen.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3">
        <Link
          href="/profiel"
          className="rounded-2xl border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
        >
          Naar profiel
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
    </PageShell>
  );
}
