import type { ReactNode } from "react";
import type { HotspringBathView, HotspringView } from "@/lib/hotspring/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { ExpandRow } from "../ExpandRow";
import { Card } from "../accommodation/Card";
import { Sources } from "../accommodation/Sources";
import { Cautions } from "../accommodation/Topics";
import { Access } from "../nature/NatureSections";
import { FeesCard, HoursCard, subRows } from "../place/PlaceCards";
import { SummaryPill } from "../SummaryPill";

// 日帰り温泉の詳細のトピックを決まった順に並べる。中身の無いトピックは出さない
// 概要の下の HotspringSummaryPill は DestDetail が置く

/** 「営業 10:00〜21:00 — 大人 1,000 円」 */
export function HotspringSummaryPill({ summary, locale }: { summary: HotspringView["summary"]; locale: Locale }) {
  const t = messages(locale).hotspring;
  return (
    <SummaryPill
      items={[
        { label: t.open, value: summary.openText },
        { label: t.adult, value: summary.adultFeeText },
      ]}
    />
  );
}

function Baths({ baths, locale }: { baths: HotspringBathView[]; locale: Locale }) {
  if (!baths.length) return null;
  const t = messages(locale).hotspring;
  return (
    <Card title={t.title.baths}>
      {baths.map((b, i) => (
        <ExpandRow key={i} label={b.label} value={b.text}>
          {subRows([
            [t.bath.spring, b.spring],
            [t.bath.gender, b.genderLabel],
            [t.bath.fee, b.feeText],
            [t.bath.reservation, b.reservationText],
            [messages(locale).accommodation.note, b.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

function Amenities({ amenities, locale }: { amenities: HotspringView["amenities"]; locale: Locale }) {
  if (!amenities) return null;
  const t = messages(locale).hotspring;
  const rows: [string, string | null][] = [
    [t.amenities.towel, amenities.towelText],
    [t.amenities.restArea, amenities.restArea],
    [t.amenities.meal, amenities.meal],
    [messages(locale).accommodation.note, amenities.note],
  ];
  const shown = rows.filter((r): r is [string, string] => r[1] !== null);
  if (!shown.length) return null;
  return (
    <Card title={t.title.amenities}>
      {shown.map(([label, value]) => (
        <ExpandRow key={label} label={label} value={value} />
      ))}
    </Card>
  );
}

export function HotspringSections({ view, map, note, locale }: { view: HotspringView; map?: ReactNode; note?: string; locale: Locale }) {
  const t = messages(locale).hotspring;
  return (
    <div className="flex flex-col gap-2.5">
      <Baths baths={view.baths} locale={locale} />
      <FeesCard title={t.title.fees} fees={view.fees} locale={locale} />
      <HoursCard title={t.title.hours} openLabel={t.open} lastEntryLabel={t.lastEntry} hours={view.hours} locale={locale} />
      <Amenities amenities={view.amenities} locale={locale} />
      <Access access={view.access} map={map} locale={locale} />
      <Cautions cautions={view.cautions} locale={locale} />
      <Sources sources={view.sources} locale={locale} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
