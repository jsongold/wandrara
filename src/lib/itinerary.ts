// Fix した旅程（1 泊 2 日）を、いいねした場所から作る（純関数）。
// すごくいい を先にし、宿を 1 日目の夜に、ほかを 1 日目の午後・2 日目の朝・2 日目の昼に置く。宿が無ければ「未定」の枠
import type { Reactions } from "./reactions";

export type ItineraryPlace = { id: string; isStay: boolean };
export type Slot = "day1-afternoon" | "day1-night" | "day2-morning" | "day2-noon";
export type ItineraryItem = { slot: Slot; id: string | null; great: boolean };

const DAY_SLOTS: Slot[] = ["day1-afternoon", "day2-morning", "day2-noon"];

export function buildItinerary(places: ItineraryPlace[], reactions: Reactions): ItineraryItem[] {
  const liked = places
    .map((p, i) => ({ p, i, r: reactions[p.id] }))
    .filter((x) => x.r === "good" || x.r === "great")
    .sort((a, b) => (a.r === "great" ? 0 : 1) - (b.r === "great" ? 0 : 1) || a.i - b.i);
  const stay = liked.find((x) => x.p.isStay);
  const others = liked.filter((x) => !x.p.isStay).slice(0, DAY_SLOTS.length);
  const at = (slot: Slot, x: (typeof liked)[number] | undefined): ItineraryItem => ({ slot, id: x?.p.id ?? null, great: x?.r === "great" });
  const items: ItineraryItem[] = [];
  if (others[0]) items.push(at("day1-afternoon", others[0]));
  items.push(at("day1-night", stay));
  if (others[1]) items.push(at("day2-morning", others[1]));
  if (others[2]) items.push(at("day2-noon", others[2]));
  return items;
}
