// 投入する dest の中身の決まり（v1）。形の検証（bundle.ts）を通った後に、種類ごとに「無いと載せられない」項目を確かめる。
// 根拠：Google Hotel Center（名前・住所・座標）、Google Things to do / OCTO（価格・所要時間・ページへのリンク）、
// schema.org（営業時間・無料かどうか）、日帰り温泉の掲載（料金・営業時間・泉質）。その国の言語（COUNTRY.language）の texts に name と summary が要る。ほかの言語は任意
import type { DestInput } from "./bundle.ts";
import { representativeLocation } from "../region/representative.ts";

/** 日本の範囲。この外の座標は誤りとして弾く（どのエリアに入るかは取り込みが位置から決める。src/lib/region） */
export const JAPAN = { latMin: 20, latMax: 46, lngMin: 122, lngMax: 154 } as const;

/** 取り込める国と、その国の言語（必須）。今は日本だけ（座標は JAPAN の範囲で確かめる）。ほかの国を受けるときは、位置から国を決めてここから言語を引く */
export const COUNTRY = { code: "JP", language: "ja" } as const;

type Row = Record<string, unknown>;
type Check = { path: string; message: string; ok: (d: DestInput) => boolean };

const present = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
const num = (v: unknown) => (present(v) ? Number(v) : NaN);
const inJapan = (lat: unknown, lng: unknown) => {
  const a = num(lat), o = num(lng);
  return a >= JAPAN.latMin && a <= JAPAN.latMax && o >= JAPAN.lngMin && o <= JAPAN.lngMax;
};
const anyText = (d: DestInput, f: string) => d.texts.some((t) => present(t[f]));
// details を JSON 1 つで持つコア（宿・体験・自然・建物・日帰り温泉・まち）の details
const json = (d: DestInput) =>
  (d.details ?? {}) as {
    rooms?: Row[];
    prices?: { items?: Row[] };
    locations?: Row[];
    booking_links?: Row[];
    access?: unknown;
    hours?: unknown;
    fees?: Row[];
    baths?: Row[];
    sources?: Row[];
  };
const isObj = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
const hasUrl = (rows: unknown) => ((rows ?? []) as Row[]).some((s) => present(s.url));

// 共通
const common: Check[] = [
  {
    path: "/texts",
    message: `その国の言語（${COUNTRY.language}）の name と summary が要る`,
    ok: (d) => d.texts.some((t) => t.lang === COUNTRY.language && present(t.name) && present(t.summary)),
  },
  { path: "/photos", message: "写真が 1 枚以上要る", ok: (d) => (d.photos ?? []).length > 0 },
  {
    path: "/core/official_url",
    message: "出どころが要る（core.official_url か sources[].url。宿・体験・自然・建物・日帰り温泉・まちは details.sources[].url も可）",
    ok: (d) => present(d.core.official_url) || hasUrl(d.sources) || hasUrl(json(d).sources),
  },
];
const address: Check = { path: "/texts", message: "住所（texts[].address）が要る", ok: (d) => anyText(d, "address") };
const coords: Check = {
  path: "/core/lat",
  message: `lat / lng が要り、日本の範囲（緯度 ${JAPAN.latMin}〜${JAPAN.latMax}・経度 ${JAPAN.lngMin}〜${JAPAN.lngMax}）に入ること`,
  ok: (d) => inJapan(d.core.lat, d.core.lng),
};

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
    // 出どころの決まりは体験用に置き換える（booking_links も可）
    ...common.filter((c) => c.path !== "/core/official_url"),
    // 施設の利用（facility_use）は決まった所要時間が無いので、所要時間は任意
    {
      path: "/core/duration_minutes",
      message: "duration_minutes が要る（施設の利用 facility_use は任意）",
      ok: (d) => d.core.kind === "facility_use" || num(d.core.duration_minutes) > 0,
    },
    {
      path: "/details/prices/items",
      message: "料金（amount > 0・currency・per）が 1 つ以上要る",
      ok: (d) => (json(d).prices?.items ?? []).some((r) => num(r.amount) > 0 && present(r.currency) && present(r.per)),
    },
    {
      path: "/details/locations",
      message:
        "集合場所（locations の kind: meeting。施設の利用は実施場所 activity でもよい）が要り、代表の場所（最初の meeting、無ければ先頭。カードとエリアに使う）が日本の範囲の座標を持つこと",
      ok: (d) => {
        const locs = json(d).locations ?? [];
        const hasPlace = locs.some((r) => r.kind === "meeting" || (d.core.kind === "facility_use" && r.kind === "activity"));
        const rep = representativeLocation("experience", d.core, d.details);
        return hasPlace && inJapan(rep.lat, rep.lng);
      },
    },
    {
      path: "/core/official_url",
      message: "ページへのリンクが要る（core.official_url か details.booking_links[].url。sources だけでは足りない）",
      ok: (d) => present(d.core.official_url) || hasUrl(json(d).booking_links),
    },
  ],
  building: [
    ...common,
    coords,
    { path: "/details/hours", message: "営業時間（details.hours）が要る", ok: (d) => isObj(json(d).hours) },
    {
      path: "/details/fees",
      message: "料金（amount ≥ 0・currency。無料は amount: 0）が 1 つ以上要る",
      ok: (d) => (json(d).fees ?? []).some((r) => num(r.amount) >= 0 && present(r.currency)),
    },
  ],
  hotspring: [
    ...common,
    coords,
    { path: "/details/hours", message: "営業時間（details.hours）が要る", ok: (d) => isObj(json(d).hours) },
    {
      path: "/details/fees",
      message: "大人の料金（audience: adult・amount ≥ 0・currency）が要る",
      ok: (d) => (json(d).fees ?? []).some((r) => r.audience === "adult" && num(r.amount) >= 0 && present(r.currency)),
    },
    {
      path: "/details/baths",
      message: "泉質（spring）のある風呂（baths）が 1 つ以上要る",
      ok: (d) => (json(d).baths ?? []).some((r) => present(r.spring)),
    },
  ],
  nature: [
    ...common,
    coords,
    { path: "/details/access", message: "行き方（details.access）が要る", ok: (d) => isObj(json(d).access) },
  ],
  village: [
    ...common,
    coords,
    { path: "/details/access", message: "行き方（details.access）が要る", ok: (d) => isObj(json(d).access) },
  ],
};

/** 決まりに合わない項目を「<path> <理由>」で返す。prefix は bundle なら "/dests/<i>" */
export function checkQuality(coreType: string, d: DestInput, prefix = ""): string[] {
  return (QUALITY_RULES[coreType] ?? []).filter((c) => !c.ok(d)).map((c) => `${prefix}${c.path} ${c.message}`);
}
