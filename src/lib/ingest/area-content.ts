// bundle の area_content（エリアに付く中身：名産・特産＝products、やった方が良いこと＝services、扱う店＝shops、
// 店が扱うもの＝shop_items）の検証と、画面が読むローカルの JSON（src/lib/area-local/<region_id>.json）への変換。
// 書き出す形の正本は area-highlights.ts の AreaLocalData（MS0 #113）。DB の表は MS1（#114）で作る
import { z } from "zod";
import { dateSchema } from "../accommodation/details.ts";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "id は英小文字・数字・- の 1〜60 文字");
const urlSchema = z.url({ protocol: /^https?$/, error: "URL は http(s)" });
const textSchema = z.string().trim().min(1);
const l10nSchema = z.strictObject({ ja: textSchema, en: textSchema });
const monthSchema = z.number().int().min(1, "月は 1〜12").max(12, "月は 1〜12");
// 年をまたぐ期間（11〜1 月）は from > to で書く
const seasonSchema = z.strictObject({ from: monthSchema, to: monthSchema });
const photoSchema = z.strictObject({
  url: urlSchema,
  license: textSchema.refine((v) => v.toLowerCase() !== "none", "写真は自由なライセンスのものだけ（license に none は書けない）"),
  credit: textSchema,
  source: urlSchema,
});
const sourcesSchema = z.array(urlSchema).min(1, "出典を 1 件以上");

const itemBase = {
  id: idSchema,
  name: l10nSchema,
  summary: l10nSchema,
  description: l10nSchema.nullish(),
  season: seasonSchema.nullish(),
  photo: photoSchema.nullish(),
  sources: sourcesSchema,
};

const productSchema = z.strictObject({ ...itemBase, kind: z.enum(["meisan", "tokusan"]) });
const serviceSchema = z.strictObject(itemBase);
const shopSchema = z.strictObject({
  id: idSchema,
  name: l10nSchema,
  online: z.boolean(),
  address: textSchema.nullish(),
  lat: z.number().min(20).max(46).nullish(),
  lng: z.number().min(122).max(154).nullish(),
  hours: l10nSchema.nullish(),
  closed: l10nSchema.nullish(),
  url: urlSchema.nullish(),
  photos: z.array(photoSchema).optional(),
  sources: sourcesSchema,
});
const shopItemSchema = z.strictObject({
  shop: idSchema,
  product: idSchema.nullish(),
  service: idSchema.nullish(),
  price: z.number().int().min(0).nullish(),
  price_note: l10nSchema.nullish(),
  checked_at: dateSchema,
  url: urlSchema.nullish(),
  sources: sourcesSchema,
});

export const areaContentSchema = z
  .strictObject({
    region_id: z.string().regex(/^[a-z0-9-]{1,40}$/, "region_id は英小文字・数字・- の 1〜40 文字"),
    products: z.array(productSchema),
    services: z.array(serviceSchema),
    shops: z.array(shopSchema),
    shop_items: z.array(shopItemSchema),
    /** 人気の候補。products か services の id を、見せたい順に */
    popular: z.array(idSchema).optional(),
  })
  .superRefine((a, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    // products と services は同じ id の並び（popular や画面の候補が id で指す）。shops は別の並び
    const items = new Map<string, "product" | "service">();
    for (const [key, list] of [["products", a.products], ["services", a.services]] as const) {
      list.forEach((x, i) => {
        if (items.has(x.id)) issue([key, i, "id"], `id ${x.id} が products / services の中で重なっている`);
        else items.set(x.id, key === "products" ? "product" : "service");
      });
    }
    const shops = new Set<string>();
    a.shops.forEach((s, i) => {
      if (shops.has(s.id)) issue(["shops", i, "id"], `id ${s.id} が shops の中で重なっている`);
      shops.add(s.id);
    });
    const pairs = new Set<string>();
    a.shop_items.forEach((x, i) => {
      if (!shops.has(x.shop)) issue(["shop_items", i, "shop"], `shop ${x.shop} が shops に無い`);
      if (!x.product === !x.service) {
        issue(["shop_items", i], "product と service のちょうど 1 つを書く");
        return;
      }
      const key = x.product ? "product" : "service";
      const id = (x.product ?? x.service)!;
      if (items.get(id) !== key) issue(["shop_items", i, key], `${key} ${id} が ${key}s に無い`);
      const pair = `${x.shop}|${key}|${id}`;
      if (pairs.has(pair)) issue(["shop_items", i], `shop ${x.shop} と ${key} ${id} の組が重なっている`);
      pairs.add(pair);
    });
    a.popular?.forEach((id, i) => {
      if (!items.has(id)) issue(["popular", i], `popular の ${id} が products / services に無い`);
    });
  });

export type AreaContent = z.infer<typeof areaContentSchema>;

type L10n = { ja: string; en: string };
type Season = { from: number; to: number };
type Photo = { url: string; license: string; credit: string; source: string };
type ItemJson = { id: string; name: L10n; summary: L10n; description: L10n | null; season: Season | null; photo: Photo | null; sources: string[] };

/** 画面が読む形（area-highlights.ts の AreaLocalData と同じ。キーは camelCase） */
export type AreaLocalJson = {
  products: (ItemJson & { kind: "meisan" | "tokusan" })[];
  services: ItemJson[];
  shops: {
    id: string; name: L10n; online: boolean; address: string | null; lat: number | null; lng: number | null;
    hours: L10n | null; closed: L10n | null; url: string | null; photos?: Photo[]; sources: string[];
  }[];
  shopItems: {
    shop: string; product: string | null; service: string | null; price: number | null; priceNote: L10n | null;
    checkedAt: string; url: string | null; sources: string[];
  }[];
  popular?: string[];
};

const item = (x: AreaContent["services"][number]): ItemJson => ({
  id: x.id,
  name: x.name,
  summary: x.summary,
  description: x.description ?? null,
  season: x.season ?? null,
  photo: x.photo ?? null,
  sources: x.sources,
});

/** 検証した area_content を、画面が読む形に変える */
export function toAreaLocal(a: AreaContent): AreaLocalJson {
  return {
    products: a.products.map((p) => ({ id: p.id, kind: p.kind, ...item(p) })),
    services: a.services.map(item),
    shops: a.shops.map((s) => ({
      id: s.id,
      name: s.name,
      online: s.online,
      address: s.address ?? null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      hours: s.hours ?? null,
      closed: s.closed ?? null,
      url: s.url ?? null,
      ...(s.photos ? { photos: s.photos } : {}),
      sources: s.sources,
    })),
    shopItems: a.shop_items.map((x) => ({
      shop: x.shop,
      product: x.product ?? null,
      service: x.service ?? null,
      price: x.price ?? null,
      priceNote: x.price_note ?? null,
      checkedAt: x.checked_at,
      url: x.url ?? null,
      sources: x.sources,
    })),
    ...(a.popular ? { popular: a.popular } : {}),
  };
}

/** dry-run で出す件数 */
export function areaContentCounts(a: AreaContent): string {
  return `products ${a.products.length} / services ${a.services.length} / shops ${a.shops.length} / shop_items ${a.shop_items.length} / popular ${a.popular?.length ?? 0}`;
}
