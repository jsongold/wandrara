import type { ReactNode } from "react";
import type {
  AccessView,
  AccommodationView,
  AmenityGroupView,
  AmenityView,
  BathView,
  ConditionsView,
  InternetView,
  MealView,
  ParkingView,
  PetsView,
  SurroundingsView,
} from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { AMENITY_LIST, labelOf } from "@/lib/vocab/accommodation";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "./Card";

// 宿の詳細のトピック。どれも出すものが無ければ null を返す（見出しごと出さない）

// ---- 小道具 ----

type Pair = [label: string, value: ReactNode];
type Text = ReturnType<typeof messages>["accommodation"];

const text = (locale: Locale): Text => messages(locale).accommodation;

/** 値のある組だけ SubRow にする。空なら空配列（ExpandRow は押せない行になる） */
function subRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <SubRow key={label} label={label} value={v} />);
}

/** 値のある組だけ ExpandRow（詳細なし）にする */
function plainRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <ExpandRow key={label} label={label} value={v} />);
}

// あり・なし／可・不可。分からなければ null
const aru = (t: Text, b: boolean | null) => (b === null ? null : b ? t.has : t.hasNot);
const ka = (t: Text, b: boolean | null) => (b === null ? null : b ? t.ok : t.notOk);
const withUnit = (n: number | null, unit: (n: number) => string) => (n === null ? null : unit(n));

// ---- 食事 ----

function mealValue(m: MealView, t: Text): string {
  if (!m.offered) return t.meal.none;
  const when = m.hours ?? (m.slots.length ? m.slots.join(t.meal.or) : null);
  return [when, m.placeLabel].filter(Boolean).join(t.sep) || t.has;
}

export function Meals({ meals, locale }: { meals: MealView[]; locale: Locale }) {
  if (!meals.length) return null;
  const t = text(locale);
  return (
    <Card title={t.title.meals}>
      {meals.map((m, i) => (
        <ExpandRow key={`${m.label}-${i}`} label={m.label} value={mealValue(m, t)}>
          {subRows([
            [t.meal.style, m.styleLabel],
            [t.meal.slots, m.slots.length ? m.slots.join(t.sep) : null],
            [t.fee, m.fee],
            [t.meal.allergy, m.allergyConsult === null ? null : m.allergyConsult ? t.meal.allergyYes : t.meal.allergyNo],
            [t.meal.selfCook, ka(t, m.selfCook)],
            [t.note, m.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

// ---- 風呂 ----

function bathValue(b: BathView, t: Text): string {
  return [b.hotSpring ? t.bath.hotSpring : null, b.saunaStyleLabel].filter(Boolean).join(t.sep) || t.has;
}

export function Baths({ baths, locale }: { baths: BathView[]; locale: Locale }) {
  if (!baths.length) return null;
  const t = text(locale);
  return (
    <Card title={t.title.baths}>
      {baths.map((b, i) => (
        <ExpandRow key={`${b.label}-${i}`} label={b.label} value={bathValue(b, t)}>
          {subRows([
            // 温泉なら行に出ている。温泉でないと分かっているときだけここに出す
            [t.bath.hotSpring, b.hotSpring === false ? t.hasNot : null],
            [t.bath.spring, b.spring],
            [t.bath.source, b.sourceLabel],
            [t.bath.capacity, withUnit(b.capacity, t.bath.people)],
            [t.bath.hours, b.hours],
            [t.bath.gender, b.genderLabel],
            [t.bath.reservation, b.reservation],
            [t.fee, b.fee],
            [t.bath.coldBath, aru(t, b.coldBath)],
            [t.bath.outdoorRest, aru(t, b.outdoorRest)],
            [t.note, b.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

// ---- 設備 ----

function internetPairs(n: InternetView, t: Text): Pair[] {
  const speed = [n.downMbps !== null ? t.amenity.down(n.downMbps) : null, n.upMbps !== null ? t.amenity.up(n.upMbps) : null]
    .filter(Boolean)
    .join(t.sep);
  return [
    ["Wi-Fi", aru(t, n.wifi)],
    [t.amenity.speed, speed || null],
    [t.amenity.measuredAt, n.measuredAt],
    [t.amenity.desk, n.deskLabel],
    [t.amenity.netNote, n.note],
  ];
}

/** 設備 1 つの詳細（付いているもの・数・有料か・メモ）を 1 行の文にする */
function amenityDetail(a: AmenityView, t: Text): string | null {
  const parts = [
    a.options.length ? a.options.join(t.sep) : null,
    withUnit(a.count, t.amenity.count),
    a.paid === null ? null : a.paid ? t.amenity.paid : t.amenity.free,
    a.note,
  ].filter(Boolean);
  return parts.length ? parts.join(t.sep) : null;
}

export function Amenities({ groups, internet, locale }: { groups: AmenityGroupView[]; internet: InternetView | null; locale: Locale }) {
  const t = text(locale);
  const wifiLabel = labelOf(AMENITY_LIST, "wifi", locale);
  const hasWifiItem = groups.some((g) => g.items.some((a) => a.label === wifiLabel));
  const net = internet ? subRows(internetPairs(internet, t)) : [];
  // Wi-Fi の設備が無いのに通信の情報があるときは、別の行に出す（どこにも出ない欄を作らない）
  const netRow = !hasWifiItem && internet && (net.length || internet.wifi !== null);
  if (!groups.length && !netRow) return null;
  return (
    <Card title={t.title.amenities}>
      {groups.map((g) => (
        <ExpandRow key={g.label} label={g.label} value={g.items.map((a) => a.label).join(t.sep)}>
          {g.items.flatMap((a) => {
            const rows = subRows([[a.label, amenityDetail(a, t)]]);
            return a.label === wifiLabel && internet ? [...rows, ...net] : rows;
          })}
        </ExpandRow>
      ))}
      {netRow && internet ? (
        <ExpandRow label={wifiLabel} value={aru(t, internet.wifi) ?? t.amenity.internet}>
          {net}
        </ExpandRow>
      ) : null}
    </Card>
  );
}

// ---- ペット ----

export function Pets({ pets, locale }: { pets: PetsView | null; locale: Locale }) {
  if (!pets) return null;
  const t = text(locale);
  return (
    <Card title={t.title.pets}>
      <ExpandRow label={t.pets.allowed} value={ka(t, pets.allowed)}>
        {subRows([
          [t.pets.size, pets.sizeLabel],
          [t.fee, pets.fee],
          [t.note, pets.note],
        ])}
      </ExpandRow>
    </Card>
  );
}

// ---- 条件 ----

export function Conditions({ conditions, locale }: { conditions: ConditionsView | null; locale: Locale }) {
  if (!conditions) return null;
  const t = text(locale);
  const c = conditions;
  const rows = plainRows([
    [t.rules.smoking, c.smokingLabel],
    [t.rules.parties, ka(t, c.parties)],
    [t.rules.fireworks, ka(t, c.fireworks)],
    [t.rules.quietHours, c.quietHours],
    [t.rules.bbq, c.bbqUntil ? t.rules.until(c.bbqUntil) : null],
    [t.rules.minNights, withUnit(c.minNights, t.rules.nights)],
    [t.rules.garbage, c.garbage],
    [t.note, c.note],
  ]);
  if (!rows.length) return null;
  return <Card title={t.title.rules}>{rows}</Card>;
}

// ---- 駐車場 ----

export function Parking({ parking, locale }: { parking: ParkingView | null; locale: Locale }) {
  if (!parking) return null;
  const t = text(locale);
  const p = parking;
  return (
    <Card title={t.title.parking}>
      <ExpandRow
        label={p.spaces !== null ? t.parking.spaces : t.parking.parking}
        value={p.spaces !== null ? t.parking.spacesCount(p.spaces) : t.has}
      >
        {subRows([
          [t.parking.place, p.placeLabel],
          [t.parking.height, withUnit(p.maxHeightM, t.parking.heightUpTo)],
          [t.fee, p.fee],
          [t.note, p.note],
        ])}
      </ExpandRow>
    </Card>
  );
}

// ---- アクセス ----

/** 「徒歩 8 分」（en は「8 min walk」）。手段だけ・時間だけでも出す */
function howLong(a: AccessView, t: Text): string | null {
  if (a.modeLabel && a.minutes !== null) return t.access.travel(a.modeLabel, a.minutes);
  return a.modeLabel ?? (a.minutes !== null ? t.access.minutes(a.minutes) : null);
}

// map は行の下に置く地図（今は準備中の枠）。地図があれば access が無くても出す
export function Access({ access, map, locale }: { access: AccessView | null; map?: ReactNode; locale: Locale }) {
  if (!access && !map) return null;
  const t = text(locale);
  const a = access;
  const value = a ? [a.station, howLong(a, t)].filter(Boolean).join(" ") : "";
  return (
    <Card title={t.title.access}>
      {a && (
        <ExpandRow label={a.station ? t.access.station : t.access.howTo} value={value || t.access.details}>
          {subRows([
            [t.access.route, a.route],
            [t.access.shuttle, aru(t, a.shuttle)],
            [t.access.slope, aru(t, a.slopeOrStairs)],
            [t.access.car, a.needsCar === null ? null : a.needsCar ? t.access.carNeeded : t.access.carNotNeeded],
            [t.access.winter, a.winterRestriction],
          ])}
        </ExpandRow>
      )}
      {map && <div className="mb-2.5 mt-1">{map}</div>}
    </Card>
  );
}

// ---- 周辺 ----

export function Surroundings({ surroundings, locale }: { surroundings: SurroundingsView | null; locale: Locale }) {
  if (!surroundings) return null;
  const t = text(locale);
  const s = surroundings;
  const rows = plainRows([
    [t.around.neighbor, withUnit(s.neighborDistanceM, t.around.meters)],
    [t.around.sightlines, s.sightlines],
    [t.around.noise, s.noiseSources],
    [t.around.view, s.view],
    [t.around.elevation, withUnit(s.elevationM, t.around.meters)],
  ]);
  if (!rows.length) return null;
  return <Card title={t.title.around}>{rows}</Card>;
}

// ---- 注意点 ----

export function Cautions({ cautions, locale }: { cautions: string[]; locale: Locale }) {
  if (!cautions.length) return null;
  return (
    <Card title={text(locale).title.cautions}>
      <ul className="m-0 list-none p-0">
        {cautions.map((c, i) => (
          <li key={i} className="border-b border-[rgba(20,20,19,.06)] py-2 text-[13px] leading-relaxed text-[#141413] last:border-b-0">
            {c}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- 許可・届出 ----

export function Licenses({ licenses, locale }: { licenses: AccommodationView["licenses"]; locale: Locale }) {
  if (!licenses.length) return null;
  return (
    <Card title={text(locale).title.licenses}>
      {licenses.map((l, i) => (
        <ExpandRow key={`${l.label}-${i}`} label={l.label} value={l.number ?? "—"} />
      ))}
    </Card>
  );
}

// ---- 予約 ----

const BUTTON = "block rounded-[10px] p-[9px] text-center text-[12.5px] font-semibold no-underline";

export function Booking({ links, locale }: { links: AccommodationView["bookingLinks"]; locale: Locale }) {
  if (!links.length) return null;
  const t = text(locale);
  // 名前に「公式」（en は official）が入っていれば、（公式）は足さない
  const official = (label: string) => label.includes("公式") || label.toLowerCase().includes(t.booking.officialWord);
  return (
    <Card title={t.title.booking}>
      <div className="flex flex-col gap-1.5 pb-2.5 pt-1">
        {links.map((l, i) => (
          <a
            key={`${l.url}-${i}`}
            href={l.url}
            target="_blank"
            rel="noopener"
            className={
              i === 0 ? `${BUTTON} bg-[#141413] text-white` : `${BUTTON} border border-[#d6d2c8] bg-white text-[#141413]`
            }
          >
            {t.booking.bookOn(l.label)}
            {l.isOfficial && !official(l.label) ? t.booking.official : ""}
          </a>
        ))}
      </div>
    </Card>
  );
}
