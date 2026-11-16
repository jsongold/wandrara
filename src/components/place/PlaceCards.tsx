import type { ReactNode } from "react";
import { messages } from "@/lib/i18n/messages";
import type { PlaceEventView, PlaceFeeView, PlaceHoursView } from "@/lib/place-view";
import type { Locale } from "@/lib/types";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "../accommodation/Card";

// 建物・日帰り温泉・まちで共通のトピック（時間・料金・催し）。中身の無いものは出さない

type Pair = [label: string, value: ReactNode];

/** 値のある組だけ SubRow にする */
export function subRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <SubRow key={label} label={label} value={v} />);
}

/** 時間。openLabel は「開館」「営業」、lastEntryLabel は「入館の締め切り」「受付の締め切り」 */
export function HoursCard({
  title,
  openLabel,
  lastEntryLabel,
  hours,
  locale,
}: {
  title: string;
  openLabel: string;
  lastEntryLabel: string;
  hours: PlaceHoursView | null;
  locale: Locale;
}) {
  if (!hours) return null;
  const p = messages(locale).place;
  const rows: [string, string | null][] = [
    [openLabel, hours.openText],
    [p.closed, hours.closedDays],
    [p.closedOther, hours.closedNote],
    [lastEntryLabel, hours.lastEntry],
    [messages(locale).accommodation.note, hours.note],
  ];
  const shown = rows.filter((r): r is [string, string] => r[1] !== null);
  if (!shown.length) return null;
  return (
    <Card title={title}>
      {shown.map(([label, value]) => (
        <ExpandRow key={label} label={label} value={value} />
      ))}
    </Card>
  );
}

/** 料金。行を開くと税とメモ */
export function FeesCard({ title, fees, locale }: { title: string; fees: PlaceFeeView[]; locale: Locale }) {
  if (!fees.length) return null;
  const p = messages(locale).place;
  return (
    <Card title={title}>
      {fees.map((f, i) => (
        <ExpandRow key={i} label={f.label} value={f.text}>
          {subRows([
            [p.tax, f.tax],
            [messages(locale).accommodation.note, f.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

/** 催し。行は名前と時期、開くと内容 */
export function EventsCard({ title, events, locale }: { title: string; events: PlaceEventView[]; locale: Locale }) {
  if (!events.length) return null;
  return (
    <Card title={title}>
      {events.map((e, i) => (
        <ExpandRow key={i} label={e.name} value={e.when ?? "—"}>
          {subRows([[messages(locale).place.content, e.note]])}
        </ExpandRow>
      ))}
    </Card>
  );
}

/** 公式サイトへのリンク（無ければ出さない） */
export function OfficialLink({ url, locale }: { url: string | null; locale: Locale }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[10px] border border-[#d6d2c8] bg-white p-[9px] text-center text-[12.5px] font-semibold text-[#141413] no-underline"
    >
      {messages(locale).place.officialSite}
    </a>
  );
}
