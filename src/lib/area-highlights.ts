// area-highlights：エリアに絞り込んだときだけ出す「エリアの一言」（名産・特産・旬・便利・人気）の中身
// 今は運営者が手で書くデモ。内容は未確認。写真が無いので色面で代える。DB に移すのは shops と「買えるもの」の表を決めてから
import type { Locale } from "./types";

export type HighlightKind = "meisan" | "tokusan" | "shun" | "benri" | "ninki";
export type HighlightAction = "shop" | "rent" | "place";

type L10n = { ja: string; en: string };
type ItemSrc = { name: L10n; note: L10n; color: string; action?: HighlightAction; pr?: boolean };

export type HighlightItem = { name: string; note: string; color: string; action: HighlightAction | null; pr: boolean };
export type HighlightGroup = { kind: HighlightKind; items: HighlightItem[] };

export const HIGHLIGHT_KINDS: HighlightKind[] = ["meisan", "tokusan", "shun", "benri", "ninki"];

const l = (ja: string, en: string): L10n => ({ ja, en });

const DATA: Record<string, Partial<Record<HighlightKind, ItemSrc[]>>> = {
  atami: {
    meisan: [
      { name: l("干物", "Dried fish (himono)"), note: l("港町・熱海の定番みやげ", "The classic souvenir of this port town"), color: "#b07a4f", action: "shop" },
      { name: l("温泉まんじゅう", "Onsen manju"), note: l("駅前の商店街で食べ歩き", "Eat as you stroll the station arcade"), color: "#a8865e", action: "shop" },
      { name: l("熱海プリン", "Atami pudding"), note: l("瓶入りのレトロなプリン", "Retro pudding in a glass jar"), color: "#c9a65a", action: "shop" },
    ],
    tokusan: [
      { name: l("橙（だいだい）", "Daidai orange"), note: l("正月飾りにも使われる柑橘", "A citrus also used in New Year decorations"), color: "#c98f3a", action: "shop" },
      { name: l("ニューサマーオレンジ", "New summer orange"), note: l("春から初夏が旬", "In season from spring to early summer"), color: "#d0a640", action: "shop" },
    ],
    shun: [
      { name: l("梅園の紅葉", "Autumn leaves at the plum garden"), note: l("11月下旬から12月上旬が見ごろ", "Best from late Nov to early Dec"), color: "#8c4a3c", action: "place" },
      { name: l("冬の花火大会", "Winter fireworks"), note: l("海の上に上がる花火", "Fireworks over the bay"), color: "#3d4a6b", action: "place" },
    ],
    benri: [
      { name: l("電動自転車を借りる", "Rent an e-bike"), note: l("坂の多い街を楽に回れる", "Get around the hilly town with ease"), color: "#4f6680", action: "rent", pr: true },
      { name: l("SUP を借りる", "Rent a SUP"), note: l("穏やかな湾で初めてでも", "A calm bay, good for first-timers"), color: "#3f6f78", action: "rent", pr: true },
    ],
    ninki: [
      { name: l("熱海サンビーチ", "Atami Sun Beach"), note: l("駅から歩ける砂浜", "A sandy beach within walking distance"), color: "#4f7a8a", action: "place" },
      { name: l("来宮神社", "Kinomiya Shrine"), note: l("樹齢二千年の大楠", "A 2,000-year-old camphor tree"), color: "#5a6b4a", action: "place" },
      { name: l("熱海城", "Atami Castle"), note: l("海を見下ろす展望", "A lookout over the sea"), color: "#6b5a4a", action: "place" },
    ],
  },
};

// エリアの一言。全国（all）・データの無いエリアでは空の配列。候補の無い項目は出さない
export function areaHighlights(area: string, locale: Locale): HighlightGroup[] {
  if (area === "all") return [];
  const src = DATA[area];
  if (!src) return [];
  return HIGHLIGHT_KINDS.flatMap((kind) => {
    const items = src[kind] ?? [];
    if (items.length === 0) return [];
    return [{
      kind,
      items: items.map((it) => ({ name: it.name[locale], note: it.note[locale], color: it.color, action: it.action ?? null, pr: !!it.pr })),
    }];
  });
}
