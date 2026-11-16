import type { ReactNode } from "react";
import type { CourseView, ExperienceView, InclusionGroupView, LocationView, ScheduleView } from "@/lib/experience/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "../accommodation/Card";
import { Sources } from "../accommodation/Sources";
import { Booking, Cautions } from "../accommodation/Topics";
import { SummaryPill } from "../SummaryPill";
import { ExperiencePriceTable } from "./ExperiencePriceTable";

// 体験の詳細のトピックを決まった順に並べる。中身の無いトピックは出さない
// 概要の下の ExperienceSummaryPill は DestDetail が置く

type Pair = [label: string, value: ReactNode];

/** 値のある組だけ SubRow にする */
function subRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <SubRow key={label} label={label} value={v} />);
}

/** 「所要 90 分 — 予約 必要」 */
export function ExperienceSummaryPill({ summary, locale }: { summary: ExperienceView["summary"]; locale: Locale }) {
  const t = messages(locale).experience;
  const { durationMinutes: min, reservationRequired: req } = summary;
  return (
    <SummaryPill
      items={[
        { label: t.durationLabel, value: min !== null ? t.minutes(min) : null },
        { label: t.title.booking, value: req === null ? null : req ? t.required : t.notRequired },
      ]}
    />
  );
}

function Courses({ courses, locale }: { courses: CourseView[]; locale: Locale }) {
  if (!courses.length) return null;
  const t = messages(locale).experience;
  const sep = messages(locale).accommodation.sep;
  return (
    <Card title={t.title.courses}>
      {courses.map((c) => (
        <ExpandRow
          key={c.key}
          label={c.label}
          value={[c.durationText, c.people ? t.people(c.people) : null].filter(Boolean).join(sep) || "—"}
        >
          {subRows([
            [t.course.content, c.description],
            [t.course.age, c.ageText],
            [t.course.languages, c.languages.length ? c.languages.join(sep) : null],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

function Schedules({ schedules, locale }: { schedules: ScheduleView[]; locale: Locale }) {
  if (!schedules.length) return null;
  const t = messages(locale).experience;
  return (
    <Card title={t.title.schedule}>
      {schedules.map((s, i) => {
        const time = [s.times, s.endTime ? t.schedule.endTime(s.endTime) : null].filter(Boolean).join(" ");
        return (
          <ExpandRow key={i} label={s.months ?? t.title.schedule} value={[s.weekdays, time].filter(Boolean).join(" ") || "—"}>
            {subRows([
              [t.schedule.months, s.months],
              [t.schedule.weekdays, s.weekdays],
              [t.schedule.times, time || null],
              [t.schedule.rain, s.rainPolicy],
            ])}
          </ExpandRow>
        );
      })}
    </Card>
  );
}

// map は行の下に置く地図（今は準備中の枠）。地図があれば集合場所が無くても出す
function Locations({ locations, map, locale }: { locations: LocationView[]; map?: ReactNode; locale: Locale }) {
  if (!locations.length && !map) return null;
  const t = messages(locale).experience;
  return (
    <Card title={t.title.location}>
      {locations.map((l, i) => (
        <ExpandRow key={i} label={l.kindLabel} value={l.label !== l.kindLabel ? l.label : (l.address ?? "—")}>
          {l.label !== l.kindLabel ? subRows([[t.location.address, l.address]]) : null}
        </ExpandRow>
      ))}
      {map && <div className="mb-2.5 mt-1">{map}</div>}
    </Card>
  );
}

function Inclusions({ groups, locale }: { groups: InclusionGroupView[]; locale: Locale }) {
  if (!groups.length) return null;
  const sep = messages(locale).accommodation.sep;
  return (
    <Card title={messages(locale).experience.title.inclusions}>
      {groups.map((g) => (
        <ExpandRow key={g.kind} label={g.label} value={g.items.join(sep)} />
      ))}
    </Card>
  );
}

export function ExperienceSections({
  view,
  map,
  note,
  locale,
}: {
  view: ExperienceView;
  map?: ReactNode;
  note?: string;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {view.priceTable && <ExperiencePriceTable table={view.priceTable} locale={locale} />}
      <Courses courses={view.courses} locale={locale} />
      <Schedules schedules={view.schedules} locale={locale} />
      <Locations locations={view.locations} map={map} locale={locale} />
      <Inclusions groups={view.inclusions} locale={locale} />
      <Cautions cautions={view.cautions} locale={locale} />
      <Booking links={view.bookingLinks} locale={locale} />
      <Sources sources={view.sources} locale={locale} />
      {note && <p className="m-0 mt-1 text-xs leading-[1.7] text-[#55524a]">{note}</p>}
    </div>
  );
}
