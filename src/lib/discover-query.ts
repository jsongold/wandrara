import { MODE_IDS } from "./modes";
import type { DiscoverQuery, Locale, Mode, SortKey } from "./types";

export const DEFAULT_QUERY: DiscoverQuery = { mode: "stay", area: "all", cat: "all", sort: "editorial", q: "" };

const SORTS: SortKey[] = ["editorial", "fresh"];
const ID = /^[a-z0-9-]{1,40}$/;

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// URL クエリを検証して探索条件にする。不正値は既定に戻す
export function parseDiscoverQuery(params: RawParams): DiscoverQuery {
  const mode = first(params.mode);
  const sort = first(params.sort);
  const area = first(params.area);
  const cat = first(params.cat);
  const q = first(params.q);
  return {
    mode: MODE_IDS.includes(mode as Mode) ? (mode as Mode) : DEFAULT_QUERY.mode,
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : DEFAULT_QUERY.sort,
    area: area && ID.test(area) ? area : "all",
    cat: cat && ID.test(cat) ? cat : "all",
    q: (q ?? "").trim().slice(0, 100),
  };
}

// 探索条件を URL（言語つきのトップ）に戻す。既定値は省く
export function serializeDiscoverQuery(query: DiscoverQuery, locale: Locale): string {
  const p = new URLSearchParams();
  if (query.mode !== DEFAULT_QUERY.mode) p.set("mode", query.mode);
  if (query.area !== "all") p.set("area", query.area);
  if (query.cat !== "all") p.set("cat", query.cat);
  if (query.sort !== DEFAULT_QUERY.sort) p.set("sort", query.sort);
  if (query.q) p.set("q", query.q);
  const s = p.toString();
  return s ? `/${locale}?${s}` : `/${locale}`;
}
