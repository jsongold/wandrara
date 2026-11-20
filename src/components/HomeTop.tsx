"use client";

import { useState } from "react";
import { messages } from "@/lib/i18n/messages";
import { MAX_PEOPLE, monthsAhead, TRIP_OPTIONS, tripLabel, type Trip, type TripOption } from "@/lib/trip";
import type { Locale } from "@/lib/types";
import { setTrip, useTrip } from "@/lib/use-trip";
import { BottomSheet, SheetHeader } from "./BottomSheet";
import { Icon } from "./icons";
import { SuggestBar } from "./SuggestBar";

// トップ：上に一言、真ん中に旅の目的（押すと目的シート）、下に提案の入力バー。目的は提案ページの URL に入る
export function HomeTop({ locale }: { locale: Locale }) {
  const m = messages(locale);
  const t = m.trip;
  const trip = useTrip();
  const [open, setOpen] = useState(false);
  const label = tripLabel(trip, { people: t.peopleUnit, month: t.month, option: t.option, sep: t.sep });
  return (
    <>
      <div className="absolute inset-x-0 top-0 bottom-[88px] flex flex-col justify-center gap-7 px-6">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 font-[family-name:var(--font-phrase)] text-[34px] font-bold leading-[1.35]">{m.home.suggestBar}</h1>
          <p className="m-0 text-[14px] leading-relaxed text-white/70">{t.heroLead}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label={t.edit} className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[18px] border border-white/15 bg-transparent px-4 text-left text-white">
          <span className="flex min-w-0 flex-auto flex-col gap-0.5">
            <span className="text-[12px] text-white/60">{t.title}</span>
            <span className={label ? "truncate text-[16px] font-bold" : "text-[15px] text-white/50"}>{label || t.empty}</span>
          </span>
          <Icon name="chevron-down" size={18} className="-rotate-90 flex-none text-white/60" />
        </button>
      </div>
      <SuggestBar locale={locale} />
      {open && <TripSheet locale={locale} trip={trip} onClose={() => setOpen(false)} />}
    </>
  );
}

// 目的シート：人数（− ＋）・時期（月）・そのほか。押したらすぐ保存する（文字は打たない）
function TripSheet({ locale, trip, onClose }: { locale: Locale; trip: Trip; onClose: () => void }) {
  const t = messages(locale).trip;
  const [months] = useState(() => monthsAhead(new Date(), 6));
  const set = (next: Partial<Trip>) => setTrip({ ...trip, ...next });
  const toggle = (o: TripOption) => set({ options: trip.options.includes(o) ? trip.options.filter((x) => x !== o) : [...trip.options, o] });
  const chip = (on: boolean) =>
    `min-h-11 cursor-pointer rounded-full border px-4 text-[14px] ${on ? "border-[#f4f1ea] bg-[#f4f1ea] font-bold text-[#141413]" : "border-white/25 bg-transparent text-white"}`;
  return (
    <BottomSheet label={t.title} onClose={onClose}>
      <SheetHeader title={t.title} onClose={onClose} />

      <section aria-label={t.people} className="flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-bold">{t.people}</h3>
        <div className="flex items-center gap-3">
          <button type="button" aria-label={t.fewer} disabled={!trip.people} onClick={() => set({ people: trip.people && trip.people > 1 ? trip.people - 1 : null })} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-transparent text-[20px] text-white disabled:opacity-30">
            −
          </button>
          <span className="min-w-[64px] text-center text-[16px] font-bold" aria-live="polite">
            {trip.people ? t.peopleUnit(trip.people) : t.undecided}
          </span>
          <button type="button" aria-label={t.more} disabled={(trip.people ?? 0) >= MAX_PEOPLE} onClick={() => set({ people: trip.people ? trip.people + 1 : 2 })} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-transparent text-[20px] text-white disabled:opacity-30">
            ＋
          </button>
        </div>
      </section>

      <section aria-label={t.when} className="flex flex-col gap-2.5">
        <h3 className="m-0 text-[14px] font-bold">{t.when}</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!trip.month} onClick={() => set({ month: null })} className={chip(!trip.month)}>
            {t.undecided}
          </button>
          {months.map((mo) => (
            <button key={mo} type="button" aria-pressed={trip.month === mo} onClick={() => set({ month: trip.month === mo ? null : mo })} className={chip(trip.month === mo)}>
              {t.month(mo)}
            </button>
          ))}
        </div>
      </section>

      <section aria-label={t.options} className="flex flex-col gap-2.5">
        <h3 className="m-0 text-[14px] font-bold">{t.options}</h3>
        <div className="flex flex-wrap gap-2">
          {TRIP_OPTIONS.map((o) => (
            <button key={o.id} type="button" aria-pressed={trip.options.includes(o.id)} onClick={() => toggle(o.id)} className={chip(trip.options.includes(o.id))}>
              {t.option[o.id]}
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setTrip({ people: null, month: null, options: [] })} className="h-12 cursor-pointer rounded-[14px] border-0 bg-transparent px-4 text-[14px] text-white/70">
          {t.clear}
        </button>
        <button type="button" onClick={onClose} className="h-12 flex-auto cursor-pointer rounded-[14px] border-0 bg-[#f4f1ea] text-[15px] font-bold text-[#141413]">
          {t.done}
        </button>
      </div>
    </BottomSheet>
  );
}
