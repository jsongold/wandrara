// OpenFreeMap の見た目の定義を、spec のメソッドで選んだ層だけにし、名前を表示の言語にする。
import type { Locale } from "../types";
import { GROUPS, type GroupKey } from "./layers";

export const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

type Layer = { id: string; type: string; layout?: Record<string, unknown> } & Record<string, unknown>;
export type Style = { layers: Layer[]; sources: Record<string, { type: string }> } & Record<string, unknown>;

/** 名前の出し方。日本語は name:ja、英語は name:en（無ければローマ字） */
function nameField(locale: Locale): unknown[] {
  return locale === "ja"
    ? ["coalesce", ["get", "name:ja"], ["get", "name"]]
    : ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
}

export function filterStyle(style: Style, groups: GroupKey[], locale: Locale): Style {
  const keep = (id: string, type: string) => type === "background" || groups.some((g) => GROUPS[g](id));
  const layers = style.layers
    .filter((l) => keep(l.id, l.type))
    .map((l) =>
      // 道の番号（shield）は ref を出すのでそのまま。ほかの文字は名前を言語で選ぶ
      l.type === "symbol" && l.layout?.["text-field"] && !/shield/.test(l.id)
        ? { ...l, layout: { ...l.layout, "text-field": nameField(locale) } }
        : l,
    );
  // 使われなくなった素材（広域の陰影の画像など）は読まない
  const used = new Set(layers.map((l) => l.source).filter((s): s is string => typeof s === "string"));
  const sources = Object.fromEntries(Object.entries(style.sources).filter(([k]) => used.has(k)));
  return { ...style, layers, sources };
}
