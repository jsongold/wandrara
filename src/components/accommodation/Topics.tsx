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
import { AMENITY_LIST, labelOf } from "@/lib/vocab/accommodation";
import { ExpandRow, SubRow } from "../ExpandRow";
import { Card } from "./Card";

// 宿の詳細のトピック。どれも出すものが無ければ null を返す（見出しごと出さない）

// ---- 小道具 ----

type Pair = [label: string, value: ReactNode];

/** 値のある組だけ SubRow にする。空なら空配列（ExpandRow は押せない行になる） */
function subRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <SubRow key={label} label={label} value={v} />);
}

/** 値のある組だけ ExpandRow（詳細なし）にする */
function plainRows(pairs: Pair[]) {
  return pairs.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([label, v]) => <ExpandRow key={label} label={label} value={v} />);
}

const aru = (b: boolean | null) => (b === null ? null : b ? "あり" : "なし");
const ka = (b: boolean | null) => (b === null ? null : b ? "可" : "不可");
const withUnit = (n: number | null, unit: string) => (n === null ? null : `${n} ${unit}`);

// ---- 食事 ----

function mealValue(m: MealView): string {
  if (!m.offered) return "なし";
  const when = m.hours ?? (m.slots.length ? m.slots.join(" か ") : null);
  return [when, m.placeLabel].filter(Boolean).join("・") || "あり";
}

export function Meals({ meals }: { meals: MealView[] }) {
  if (!meals.length) return null;
  return (
    <Card title="食事">
      {meals.map((m, i) => (
        <ExpandRow key={`${m.label}-${i}`} label={m.label} value={mealValue(m)}>
          {subRows([
            ["形式", m.styleLabel],
            ["選べる時刻", m.slots.length ? m.slots.join("・") : null],
            ["料金", m.fee],
            ["アレルギー", m.allergyConsult === null ? null : m.allergyConsult ? "事前に相談できる" : "相談できない"],
            ["自炊", ka(m.selfCook)],
            ["メモ", m.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

// ---- 風呂 ----

function bathValue(b: BathView): string {
  return [b.hotSpring ? "温泉" : null, b.saunaStyleLabel].filter(Boolean).join("・") || "あり";
}

export function Baths({ baths }: { baths: BathView[] }) {
  if (!baths.length) return null;
  return (
    <Card title="風呂">
      {baths.map((b, i) => (
        <ExpandRow key={`${b.label}-${i}`} label={b.label} value={bathValue(b)}>
          {subRows([
            // 温泉なら行に出ている。温泉でないと分かっているときだけここに出す
            ["温泉", b.hotSpring === false ? "なし" : null],
            ["泉質", b.spring],
            ["源泉", b.sourceLabel],
            ["定員", withUnit(b.capacity, "名")],
            ["時間", b.hours],
            ["男女", b.genderLabel],
            ["予約", b.reservation],
            ["料金", b.fee],
            ["水風呂", aru(b.coldBath)],
            ["外気浴", aru(b.outdoorRest)],
            ["メモ", b.note],
          ])}
        </ExpandRow>
      ))}
    </Card>
  );
}

// ---- 設備 ----

const WIFI_LABEL = labelOf(AMENITY_LIST, "wifi");

function internetPairs(n: InternetView): Pair[] {
  const speed = [n.downMbps !== null ? `下り ${n.downMbps} Mbps` : null, n.upMbps !== null ? `上り ${n.upMbps} Mbps` : null]
    .filter(Boolean)
    .join("・");
  return [
    ["Wi-Fi", n.wifi === null ? null : n.wifi ? "あり" : "なし"],
    ["速さ（実測）", speed || null],
    ["測った日", n.measuredAt],
    ["仕事用の机", n.deskLabel],
    ["通信のメモ", n.note],
  ];
}

/** 設備 1 つの詳細（付いているもの・数・有料か・メモ）を 1 行の文にする */
function amenityDetail(a: AmenityView): string | null {
  const parts = [
    a.options.length ? a.options.join("・") : null,
    withUnit(a.count, "台"),
    a.paid === null ? null : a.paid ? "有料" : "無料",
    a.note,
  ].filter(Boolean);
  return parts.length ? parts.join("・") : null;
}

export function Amenities({ groups, internet }: { groups: AmenityGroupView[]; internet: InternetView | null }) {
  const hasWifiItem = groups.some((g) => g.items.some((a) => a.label === WIFI_LABEL));
  const net = internet ? subRows(internetPairs(internet)) : [];
  // Wi-Fi の設備が無いのに通信の情報があるときは、別の行に出す（どこにも出ない欄を作らない）
  const netRow = !hasWifiItem && internet && (net.length || internet.wifi !== null);
  if (!groups.length && !netRow) return null;
  return (
    <Card title="設備">
      {groups.map((g) => (
        <ExpandRow key={g.label} label={g.label} value={g.items.map((a) => a.label).join("・")}>
          {g.items.flatMap((a) => {
            const rows = subRows([[a.label, amenityDetail(a)]]);
            return a.label === WIFI_LABEL && internet ? [...rows, ...net] : rows;
          })}
        </ExpandRow>
      ))}
      {netRow && internet ? (
        <ExpandRow label={WIFI_LABEL} value={aru(internet.wifi) ?? "通信"}>
          {net}
        </ExpandRow>
      ) : null}
    </Card>
  );
}

// ---- ペット ----

export function Pets({ pets }: { pets: PetsView | null }) {
  if (!pets) return null;
  return (
    <Card title="ペット">
      <ExpandRow label="同伴" value={ka(pets.allowed)}>
        {subRows([
          ["大きさ", pets.sizeLabel],
          ["料金", pets.fee],
          ["メモ", pets.note],
        ])}
      </ExpandRow>
    </Card>
  );
}

// ---- 条件 ----

export function Conditions({ conditions }: { conditions: ConditionsView | null }) {
  if (!conditions) return null;
  const c = conditions;
  const rows = plainRows([
    ["喫煙", c.smokingLabel],
    ["パーティー", ka(c.parties)],
    ["花火", ka(c.fireworks)],
    ["静かな時間", c.quietHours],
    ["BBQ", c.bbqUntil ? `${c.bbqUntil} まで` : null],
    ["最短泊数", withUnit(c.minNights, "泊")],
    ["ゴミ", c.garbage],
    ["メモ", c.note],
  ]);
  if (!rows.length) return null;
  return <Card title="条件">{rows}</Card>;
}

// ---- 駐車場 ----

export function Parking({ parking }: { parking: ParkingView | null }) {
  if (!parking) return null;
  const p = parking;
  return (
    <Card title="駐車場">
      <ExpandRow label={p.spaces !== null ? "台数" : "駐車場"} value={p.spaces !== null ? `${p.spaces} 台` : "あり"}>
        {subRows([
          ["場所", p.placeLabel],
          ["高さの制限", withUnit(p.maxHeightM, "m まで")],
          ["料金", p.fee],
          ["メモ", p.note],
        ])}
      </ExpandRow>
    </Card>
  );
}

// ---- アクセス ----

/** 「徒歩 8 分」。手段だけ・時間だけでも出す */
function howLong(a: AccessView): string | null {
  return [a.modeLabel, a.minutes !== null ? `${a.minutes} 分` : null].filter(Boolean).join(" ") || null;
}

// map は行の下に置く地図（今は準備中の枠）。地図があれば access が無くても出す
export function Access({ access, map }: { access: AccessView | null; map?: ReactNode }) {
  if (!access && !map) return null;
  const a = access;
  const value = a ? [a.station, howLong(a)].filter(Boolean).join(" ") : "";
  return (
    <Card title="アクセス">
      {a && (
        <ExpandRow label={a.station ? "最寄り駅" : "行き方"} value={value || "詳細"}>
          {subRows([
            ["道順", a.route],
            ["送迎", aru(a.shuttle)],
            ["坂や階段", aru(a.slopeOrStairs)],
            ["車", a.needsCar === null ? null : a.needsCar ? "必要" : "なくても行ける"],
            ["冬の制限", a.winterRestriction],
          ])}
        </ExpandRow>
      )}
      {map && <div className="mb-2.5 mt-1">{map}</div>}
    </Card>
  );
}

// ---- 周辺 ----

export function Surroundings({ surroundings }: { surroundings: SurroundingsView | null }) {
  if (!surroundings) return null;
  const s = surroundings;
  const rows = plainRows([
    ["隣の家まで", withUnit(s.neighborDistanceM, "m")],
    ["視線", s.sightlines],
    ["音", s.noiseSources],
    ["眺め", s.view],
    ["標高", withUnit(s.elevationM, "m")],
  ]);
  if (!rows.length) return null;
  return <Card title="周辺">{rows}</Card>;
}

// ---- 注意点 ----

export function Cautions({ cautions }: { cautions: string[] }) {
  if (!cautions.length) return null;
  return (
    <Card title="注意点">
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

export function Licenses({ licenses }: { licenses: AccommodationView["licenses"] }) {
  if (!licenses.length) return null;
  return (
    <Card title="許可・届出">
      {licenses.map((l, i) => (
        <ExpandRow key={`${l.label}-${i}`} label={l.label} value={l.number ?? "—"} />
      ))}
    </Card>
  );
}

// ---- 予約 ----

const BUTTON = "block rounded-[10px] p-[9px] text-center text-[12.5px] font-semibold no-underline";

export function Booking({ links }: { links: AccommodationView["bookingLinks"] }) {
  if (!links.length) return null;
  return (
    <Card title="予約">
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
            {l.label}で予約{l.isOfficial && !l.label.includes("公式") ? "（公式）" : ""}
          </a>
        ))}
      </div>
    </Card>
  );
}
