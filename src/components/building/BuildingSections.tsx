import type { ReactNode } from "react";
import type { BuildingView } from "@/lib/building/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { Sources } from "../accommodation/Sources";
import { Booking, Cautions } from "../accommodation/Topics";
import { Access } from "../nature/NatureSections";
import { EventsCard, FeesCard, HoursCard, OfficialLink } from "../place/PlaceCards";
import { SummaryPill } from "../SummaryPill";

// 建物の詳細のトピックを決まった順に並べる。中身の無いトピックは出さない
// 概要の下の BuildingSummaryPill は DestDetail が置く

/** 「開館 09:00〜17:00 — 入館 1,500 円」 */
export function BuildingSummaryPill({ summary, locale }: { summary: BuildingView["summary"]; locale: Locale }) {
  const t = messages(locale).building;
  return (
    <SummaryPill
      items={[
        { label: t.open, value: summary.openText },
        { label: t.entry, value: summary.feeText },
      ]}
    />
  );
}

export function BuildingSections({ view, map, note, locale }: { view: BuildingView; map?: ReactNode; note?: string; locale: Locale }) {
  const t = messages(locale).building;
  return (
    <div className="flex flex-col gap-2.5">
      <HoursCard title={t.title.hours} openLabel={t.open} lastEntryLabel={t.lastEntry} hours={view.hours} locale={locale} />
      <FeesCard title={t.title.fees} fees={view.fees} locale={locale} />
      <EventsCard title={t.title.events} events={view.events} locale={locale} />
      <Access access={view.access} map={map} locale={locale} />
      <Cautions cautions={view.cautions} locale={locale} />
      <Booking links={view.bookingLinks} locale={locale} />
      <OfficialLink url={view.officialUrl} locale={locale} />
      <Sources sources={view.sources} locale={locale} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
