import type { ReactNode } from "react";
import type { NatureAccessView, NatureView, RestrictionView, TrailView } from "@/lib/nature/view";
import { num } from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "../accommodation/Card";
import { Sources } from "../accommodation/Sources";
import { Cautions } from "../accommodation/Topics";
import { SummaryPill } from "../SummaryPill";

// 自然の詳細のトピックを決まった順に並べる。中身の無いトピックは出さない
// 概要の下の NatureSummaryPill は DestDetail が置く

type Pair = [label: string, value: ReactNode];

/** 値のある組だけ SubRow にする */
function subRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <SubRow key={label} label={label} value={v} />);
}

/** 「見頃 4〜5 月 — 入場無料」 */
export function NatureSummaryPill({ summary, locale }: { summary: NatureView["summary"]; locale: Locale }) {
  const t = messages(locale).nature;
  return (
    <SummaryPill
      items={[
        { label: t.title.seasons, value: summary.seasonText },
        { value: summary.feeText },
      ]}
    />
  );
}

function Seasons({ seasons, locale }: { seasons: NatureView["seasons"]; locale: Locale }) {
  if (!seasons.length) return null;
  const t = messages(locale).nature;
  return (
    <Card title={t.title.seasons}>
      {seasons.map((s, i) => (
        <ExpandRow key={i} label={s.subject || t.title.seasons} value={s.months} />
      ))}
    </Card>
  );
}

// 時間と入場料。どちらも無ければ出さない
function HoursFees({ hours, fees, locale }: { hours: NatureView["hours"]; fees: NatureView["fees"]; locale: Locale }) {
  const t = messages(locale).nature;
  const hoursRow = hours && (hours.text || hours.closedNote);
  if (!hoursRow && !fees.length) return null;
  return (
    <Card title={t.title.hoursFees}>
      {hours && hoursRow && (
        <ExpandRow label={t.hours} value={hours.text ?? "—"}>
          {subRows([[t.closed, hours.closedNote]])}
        </ExpandRow>
      )}
      {fees.map((f, i) => (
        <ExpandRow key={i} label={f.audienceLabel ?? t.entry} value={f.text}>
          {subRows([[messages(locale).accommodation.note, f.note]])}
        </ExpandRow>
      ))}
    </Card>
  );
}

// map は行の下に置く地図（今は準備中の枠）。地図があれば access が無くても出す
function Access({ access, map, locale }: { access: NatureAccessView | null; map?: ReactNode; locale: Locale }) {
  if (!access && !map) return null;
  const t = messages(locale).nature;
  const a = messages(locale).accommodation;
  // 駅が無く手段・時間だけのときも、行き方として出す
  const value = access ? [access.station, access.how ?? access.modeLabel].filter(Boolean).join(" ") : "";
  const hasMain = access && (value || access.route);
  return (
    <Card title={t.title.access}>
      {access && hasMain && (
        <ExpandRow label={access.station ? t.access.station : a.access.howTo} value={value || a.access.details}>
          {subRows([[t.access.route, access.route]])}
        </ExpandRow>
      )}
      {access?.parking && <ExpandRow label={a.title.parking} value={access.parking.text} />}
      {map && <div className="mb-2.5 mt-1">{map}</div>}
    </Card>
  );
}

function Trails({ trails, locale }: { trails: TrailView[]; locale: Locale }) {
  if (!trails.length) return null;
  const t = messages(locale).nature;
  return (
    <Card title={t.title.trails}>
      {trails.map((tr) => (
        <ExpandRow key={tr.key} label={tr.label} value={tr.summary ?? tr.difficultyLabel ?? "—"}>
          {subRows([
            [t.trail.distanceLabel, tr.distanceKm !== null ? t.trail.distance(num(tr.distanceKm)) : null],
            [t.trail.elevationLabel, tr.elevationGainM !== null ? `${num(tr.elevationGainM)} m` : null],
            [t.trail.difficulty, tr.difficultyLabel],
            [t.trail.durationLabel, tr.durationMinutes !== null ? t.trail.minutes(tr.durationMinutes) : null],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

function Restrictions({ restrictions, locale }: { restrictions: RestrictionView[]; locale: Locale }) {
  if (!restrictions.length) return null;
  const t = messages(locale).nature;
  const sep = messages(locale).accommodation.sep;
  return (
    <Card title={t.title.restrictions}>
      {restrictions.map((r, i) => (
        <ExpandRow key={i} label={r.kindLabel} value={[r.note, r.period].filter(Boolean).join(sep) || "—"} />
      ))}
    </Card>
  );
}

export function NatureSections({
  view,
  map,
  note,
  locale,
}: {
  view: NatureView;
  map?: ReactNode;
  note?: string;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <Seasons seasons={view.seasons} locale={locale} />
      <HoursFees hours={view.hours} fees={view.fees} locale={locale} />
      <Access access={view.access} map={map} locale={locale} />
      <Trails trails={view.trails} locale={locale} />
      <Restrictions restrictions={view.restrictions} locale={locale} />
      <Cautions cautions={view.cautions} locale={locale} />
      <Sources sources={view.sources} locale={locale} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
