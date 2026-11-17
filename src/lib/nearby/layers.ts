// 地図に載せるものの定義。1 つ = 1 メソッド（spec.ts の nearbyMap().green() など）。
// sources は読む区画の層（OpenMapTiles の層の名前）。使われない層は読まない。
import type { Locale } from "../types";
import type { MapFeature } from "./build";

/** 線・面の描き方。parts の順に下から重ねる */
export type PathPart = { key: string; fill?: string; stroke?: string; width?: number };
export type PathLayerDef = {
  sources: string[];
  parts: PathPart[];
  /** この 1 件をどの part で描くか（描かないなら []） */
  pick(f: MapFeature): string[];
};

/** 近くの場所の一覧（駅など）。name が null の件は出さない */
export type PlaceDef = {
  sources: string[];
  name(props: Record<string, unknown>, locale: Locale): string | null;
};

const MAJOR_ROADS = new Set(["motorway", "trunk", "primary", "secondary"]);
const MINOR_ROADS = new Set(["tertiary", "minor", "service"]);

export const PATH_LAYERS = {
  green: {
    sources: ["landcover", "park"],
    parts: [{ key: "green", fill: "#d7e6cc" }],
    pick: (f) => (f.type === 3 && (f.layer === "park" || f.props.class === "wood" || f.props.class === "grass") ? ["green"] : []),
  },
  water: {
    sources: ["water", "waterway"],
    parts: [
      { key: "water", fill: "#b9d7e8" },
      { key: "waterway", stroke: "#b9d7e8", width: 3 },
    ],
    pick: (f) =>
      f.layer === "water" ? (f.type === 3 ? ["water"] : []) : f.props.class === "river" || f.props.class === "canal" ? ["waterway"] : [],
  },
  // 小道・階段・ホームは出さない。縁取りを全部の道の下に敷く
  roads: {
    sources: ["transportation"],
    parts: [
      { key: "roadCasing", stroke: "#d6d3ca", width: 5 },
      { key: "roadMinor", stroke: "#ffffff", width: 3 },
      { key: "roadMajor", stroke: "#fbe3b4", width: 4.5 },
    ],
    pick: (f) => {
      if (f.type !== 2) return [];
      const c = String(f.props.class);
      return MAJOR_ROADS.has(c) ? ["roadCasing", "roadMajor"] : MINOR_ROADS.has(c) ? ["roadCasing", "roadMinor"] : [];
    },
  },
  rail: {
    sources: ["transportation"],
    parts: [{ key: "rail", stroke: "#a19e95", width: 1.5 }],
    pick: (f) => (f.type === 2 && (f.props.class === "rail" || f.props.class === "transit") ? ["rail"] : []),
  },
} satisfies Record<string, PathLayerDef>;

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** 表示の言語の名前。英語が無ければ日本語 */
function localName(props: Record<string, unknown>, locale: Locale): string | null {
  const ja = str(props["name:ja"]) ?? str(props.name);
  if (!ja || locale === "ja") return ja;
  return str(props["name:en"]) ?? str(props.name_en) ?? str(props["name:latin"]) ?? ja;
}

export const PLACES = {
  // 客の乗れる駅だけ（信号場は除く）
  stations: {
    sources: ["poi"],
    name: (props, locale) => {
      if (props.class !== "railway" || (props.subclass !== "station" && props.subclass !== "halt")) return null;
      if (str(props["name:ja"] ?? props.name)?.endsWith("信号場")) return null;
      return localName(props, locale);
    },
  },
} satisfies Record<string, PlaceDef>;

export type PathLayerKey = keyof typeof PATH_LAYERS;
export type PlaceKey = keyof typeof PLACES;
