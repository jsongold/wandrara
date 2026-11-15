// 投入する dest の中身の決まり（v1）。形の検証（bundle.ts）を通った後に、種類ごとに「無いと載せられない」項目を確かめる。
// 根拠：Google Hotel Center（名前・住所・座標）、Google Things to do / OCTO（価格・所要時間・ページへのリンク）、
// schema.org（営業時間・無料かどうか）、日帰り温泉の掲載（料金・営業時間・泉質）。言語は問わない（どれか 1 つの言語であればよい）
import type { DestInput } from "./bundle.ts";

/** 箱根・伊豆の範囲（伊豆諸島は含めない）。この外の座標は誤りとして弾く */
export const AREA = { latMin: 34.55, latMax: 35.35, lngMin: 138.65, lngMax: 139.25 } as const;

type Row = Record<string, unknown>;
type Check = { path: string; message: string; ok: (d: DestInput) => boolean };

const rowsOf = (d: DestInput, key: string): Row[] => ((d.details ?? {})[key] ?? []) as Row[];
const present = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
const num = (v: unknown) => (present(v) ? Number(v) : NaN);
const inArea = (lat: unknown, lng: unknown) => {
  const a = num(lat), o = num(lng);
  return a >= AREA.latMin && a <= AREA.latMax && o >= AREA.lngMin && o <= AREA.lngMax;
};
const anyText = (d: DestInput, f: string) => d.texts.some((t) => present(t[f]));
// details を JSON 1 つで持つコア（宿）の details
const json = (d: DestInput) => (d.details ?? {}) as { rooms?: Row[]; prices?: { items?: Row[] }; sources?: Row[] };
const hasUrl = (rows: unknown) => ((rows ?? []) as Row[]).some((s) => present(s.url));

// 共通
const common: Check[] = [
  { path: "/texts", message: "name と summary が要る（どの言語でもよい）", ok: (d) => d.texts.some((t) => present(t.name) && present(t.summary)) },
  { path: "/photos", message: "写真が 1 枚以上要る", ok: (d) => (d.photos ?? []).length > 0 },
  { path: "/core/region_id", message: "region_id が要る", ok: (d) => present(d.core.region_id) },
  {
    path: "/core/official_url",
    message: "出どころが要る（core.official_url か sources[].url。宿は details.sources[].url も可）",
    ok: (d) => present(d.core.official_url) || hasUrl(d.sources) || hasUrl(json(d).sources),
  },
];
const address: Check = { path: "/texts", message: "住所（texts[].address）が要る", ok: (d) => anyText(d, "address") };
const coords: Check = {
  path: "/core/lat",
  message: `lat / lng が要り、箱根・伊豆の範囲（緯度 ${AREA.latMin}〜${AREA.latMax}・経度 ${AREA.lngMin}〜${AREA.lngMax}）に入ること`,
  ok: (d) => inArea(d.core.lat, d.core.lng),
};
const atLeast = (key: string, what: string, ok: (r: Row) => boolean = () => true): Check => ({
  path: `/details/${key}`,
  message: `${what}が 1 つ以上要る`,
  ok: (d) => rowsOf(d, key).some(ok),
});

/** 種類ごとの決まり。core_type → 確かめること */
export const QUALITY_RULES: Record<string, Check[]> = {
  accommodation: [
    ...common,
    address,
    coords,
    { path: "/core/check_in", message: "check_in と check_out が要る", ok: (d) => present(d.core.check_in) && present(d.core.check_out) },
    { path: "/details/rooms", message: "定員（capacity > 0）のある部屋（rooms）が 1 つ以上要る", ok: (d) => (json(d).rooms ?? []).some((r) => num(r.capacity) > 0) },
    {
      path: "/details/prices/items",
      message: "宿泊料（kind: room・amount > 0・currency）が 1 つ以上要る",
      ok: (d) => (json(d).prices?.items ?? []).some((r) => r.kind === "room" && num(r.amount) > 0 && present(r.currency)),
    },
    {
      path: "/photos",
      message: "写真の room は details.rooms の key のどれか",
      ok: (d) => {
        const keys = new Set((json(d).rooms ?? []).map((r) => r.key));
        return (d.photos ?? []).every((p) => !present(p.room) || keys.has(p.room));
      },
    },
  ],
  experience: [
    ...common,
    atLeast("prices", "料金（amount > 0・currency）", (r) => num(r.amount) > 0 && present(r.currency)),
    { path: "/core/duration_minutes", message: "duration_minutes が要る", ok: (d) => num(d.core.duration_minutes) > 0 },
    {
      path: "/core/official_url",
      message: "ページへのリンクが要る（core.official_url か details.booking_links）",
      ok: (d) => present(d.core.official_url) || rowsOf(d, "booking_links").some((r) => present(r.url)),
    },
    atLeast("locations", "箱根・伊豆の範囲の座標を持つ集合場所（locations）", (r) => inArea(r.lat, r.lng)),
  ],
  building: [
    ...common,
    address,
    coords,
    atLeast("hours", "営業時間（hours）"),
    atLeast("fees", "料金（fees。無料は amount: 0）", (r) => num(r.amount) >= 0),
  ],
  hotspring: [
    ...common,
    address,
    coords,
    atLeast("hours", "営業時間（hours）"),
    atLeast("fees", "大人の料金（fee_kind: adult・amount）", (r) => r.fee_kind === "adult" && num(r.amount) >= 0),
    atLeast("baths", "泉質（spring_quality）のある浴槽（baths）", (r) => present(r.spring_quality)),
  ],
  nature: [...common, coords, atLeast("access", "行き方（access）")],
  village: [...common, coords, atLeast("access", "行き方（access）")],
};

/** 決まりに合わない項目を「<path> <理由>」で返す。prefix は bundle なら "/dests/<i>" */
export function checkQuality(coreType: string, d: DestInput, prefix = ""): string[] {
  return (QUALITY_RULES[coreType] ?? []).filter((c) => !c.ok(d)).map((c) => `${prefix}${c.path} ${c.message}`);
}
