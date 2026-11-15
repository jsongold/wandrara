// 宿の details.prices（料金区分と料金）の形。DB の外部キー・CHECK の代わりに、ここで中の食い違いを確かめる。
// items の room が rooms の key に実在するかは rooms も見るので、ここでは形だけ確かめる
import { z } from "zod";
import { PRICE_AUDIENCES, PRICE_KINDS, PRICE_MEALS, PRICE_PERS } from "../vocab/accommodation.ts";

const keySchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, "key は英小文字・数字・_・- の 1〜40 文字");
const dateSchema = z.iso.date("日付は YYYY-MM-DD");
const currencySchema = z.string().regex(/^[A-Z]{3}$/, "通貨は ISO 4217 の 3 文字（例：JPY）");

// 込みにできる料金（kind の一部）
const INCLUDABLE = ["service_fee", "bath_tax", "lodging_tax", "cleaning"] as const;

export const seasonSchema = z.strictObject({
  key: keySchema,
  valid_from: dateSchema,
  valid_to: dateSchema,
  is_default: z.boolean().optional(),
  priority: z.int().optional(),
  weekdays: z.array(z.int().min(1).max(7)).optional(), // 1=月 … 7=日
  holidays: z.boolean().optional(),
  day_before_holiday: z.boolean().optional(),
  dates: z.array(z.strictObject({ from: dateSchema, to: dateSchema })).optional(),
});
export type Season = z.infer<typeof seasonSchema>;

export const priceItemSchema = z.strictObject({
  kind: z.enum(PRICE_KINDS),
  per: z.enum(PRICE_PERS),
  room: keySchema.optional(),
  season: keySchema.optional(), // 空なら全部の日
  amount: z.number().min(0).optional(),
  amount_max: z.number().min(0).optional(),
  rate_percent: z.number().min(0).max(100).optional(), // 大人の料金に対する割合
  currency: currencySchema,
  tax_included: z.boolean().optional(),
  guests_min: z.int().min(1).optional(),
  guests_max: z.int().min(1).optional(),
  audience: z.enum(PRICE_AUDIENCES).optional(),
  age_min: z.int().min(0).optional(),
  age_max: z.int().min(0).optional(),
  meals: z.enum(PRICE_MEALS).optional(),
  includes: z.array(z.enum(INCLUDABLE)).optional(),
});
export type PriceItem = z.infer<typeof priceItemSchema>;

export const pricesSchema = z
  .strictObject({
    seasons: z.array(seasonSchema).optional(),
    items: z.array(priceItemSchema),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const seasons = p.seasons ?? [];
    const keys = new Set<string>();
    seasons.forEach((s, i) => {
      if (keys.has(s.key)) issue(["seasons", i, "key"], `区分の key ${s.key} が重なっている`);
      keys.add(s.key);
      if (s.valid_from > s.valid_to) issue(["seasons", i, "valid_to"], "valid_to が valid_from より前");
      s.dates?.forEach((d, j) => {
        if (d.from > d.to) issue(["seasons", i, "dates", j, "to"], "to が from より前");
        if (d.from < s.valid_from || d.to > s.valid_to) issue(["seasons", i, "dates", j], "日付が区分の valid_from〜valid_to の外");
      });
      if (s.weekdays && new Set(s.weekdays).size !== s.weekdays.length) issue(["seasons", i, "weekdays"], "曜日が重なっている");
    });
    p.items.forEach((it, i) => {
      if (it.season !== undefined && !keys.has(it.season)) issue(["items", i, "season"], `区分 ${it.season} が seasons に無い`);
      if (it.guests_min !== undefined && it.guests_max !== undefined && it.guests_min > it.guests_max)
        issue(["items", i, "guests_max"], "guests_max が guests_min より小さい");
      if (it.age_min !== undefined && it.age_max !== undefined && it.age_min > it.age_max) issue(["items", i, "age_max"], "age_max が age_min より小さい");
      if (it.amount !== undefined && it.amount_max !== undefined && it.amount > it.amount_max)
        issue(["items", i, "amount_max"], "amount_max が amount より小さい");
      if ((it.amount === undefined) === (it.rate_percent === undefined)) issue(["items", i], "amount と rate_percent はどちらか一方だけ書く");
      if (it.includes) {
        if (new Set(it.includes).size !== it.includes.length) issue(["items", i, "includes"], "includes が重なっている");
        if ((it.includes as readonly string[]).includes(it.kind)) issue(["items", i, "includes"], `includes に自分の種類 ${it.kind} を入れない`);
      }
    });
  });
export type Prices = z.infer<typeof pricesSchema>;

/** YYYY-MM-DD の曜日（1=月 … 7=日）。UTC で数える */
function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** その日に当たる区分。有効な期間の中だけを見て、曜日・日付が当たる区分の priority が高いもの、無ければ既定の区分 */
export function seasonFor(date: string, seasons: Season[]): Season | undefined {
  const live = seasons.filter((s) => s.valid_from <= date && date <= s.valid_to);
  const byPriority = (a: Season, b: Season) => (b.priority ?? 0) - (a.priority ?? 0);
  // holidays・day_before_holiday は祝日の暦がまだ無いので見ない
  const wd = isoWeekday(date);
  const hit = live
    .filter((s) => !s.is_default)
    .filter((s) => s.weekdays?.includes(wd) || s.dates?.some((d) => d.from <= date && date <= d.to))
    .sort(byPriority);
  if (hit[0]) return hit[0];
  return live.filter((s) => s.is_default).sort(byPriority)[0];
}
