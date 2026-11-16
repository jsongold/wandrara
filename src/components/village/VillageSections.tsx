import type { ReactNode } from "react";
import { num } from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { VillageView, WalkView } from "@/lib/village/view";
import type { Locale } from "@/lib/types";
import { ExpandRow } from "../ExpandRow";
import { Card } from "../accommodation/Card";
import { Sources } from "../accommodation/Sources";
import { Cautions } from "../accommodation/Topics";
import { Access } from "../nature/NatureSections";
import { EventsCard, subRows } from "../place/PlaceCards";
import { SummaryPill } from "../SummaryPill";

// まちの詳細のトピックを決まった順に並べる。中身の無いトピックは出さない
// 概要の下の VillageSummaryPill は DestDetail が置く

/** 「歩く 約 60 分 — 店 10:00〜17:00」 */
export function VillageSummaryPill({ summary, locale }: { summary: VillageView["summary"]; locale: Locale }) {
  const t = messages(locale).village;
  return (
    <SummaryPill
      items={[
        { label: t.walk, value: summary.walkText },
        { label: t.shops, value: summary.shopText },
      ]}
    />
  );
}

function Walks({ walks, locale }: { walks: WalkView[]; locale: Locale }) {
  if (!walks.length) return null;
  const t = messages(locale).village;
  return (
    <Card title={t.title.walks}>
      {walks.map((w) => (
        <ExpandRow key={w.key} label={w.label} value={w.summary ?? "—"}>
          {subRows([
            [t.area, w.area],
            [t.duration, w.durationMinutes !== null ? t.minutes(w.durationMinutes) : null],
            [t.distance, w.distanceKm !== null ? t.km(num(w.distanceKm)) : null],
            [messages(locale).accommodation.note, w.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

function ShopHours({ shopHours, locale }: { shopHours: VillageView["shopHours"]; locale: Locale }) {
  if (!shopHours || (!shopHours.text && !shopHours.note)) return null;
  const t = messages(locale).village;
  return (
    <Card title={t.title.shopHours}>
      {shopHours.text && <ExpandRow label={t.shopsOpen} value={shopHours.text} />}
      {shopHours.note && <ExpandRow label={messages(locale).accommodation.note} value={shopHours.note} />}
    </Card>
  );
}

export function VillageSections({ view, map, note, locale }: { view: VillageView; map?: ReactNode; note?: string; locale: Locale }) {
  const t = messages(locale).village;
  return (
    <div className="flex flex-col gap-2.5">
      <Walks walks={view.walks} locale={locale} />
      <ShopHours shopHours={view.shopHours} locale={locale} />
      <EventsCard title={t.title.events} events={view.events} locale={locale} />
      <Access access={view.access} map={map} locale={locale} />
      <Cautions cautions={view.cautions} locale={locale} />
      <Sources sources={view.sources} locale={locale} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
