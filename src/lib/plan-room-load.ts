// 提案ルームに渡すものを、URL の値（?t=&area=&p=&m=&o=）から作る。提案ページと評価（/api/propose-eval）が同じものを使う
import { getAreaSheetData } from "./data";
import { getDestTraits } from "./dest-traits-source";
import { messages } from "./i18n/messages";
import { planCards } from "./plan-candidates";
import { roomData, type RoomData } from "./plan-room";
import { inArea, parseSuggestArea, parseSuggestTraits, proposalName } from "./suggest";
import { keywordOf } from "./suggest-vocab";
import { parseTrip, tripKeywords, tripLabel, tripQuery } from "./trip";
import type { Locale } from "./types";

export type RoomLoad = { name: string; picked: string[]; area: string; trip: string; tripParams: Record<string, string>; conditions: string[]; data: RoomData };

export async function loadRoom(locale: Locale, sp: Record<string, string | string[] | undefined>): Promise<RoomLoad> {
  const picked = parseSuggestTraits(sp.t);
  const area = parseSuggestArea(sp.area);
  // 旅の目的（目的シート）：そのほか（犬連れ など）と季節は条件に足す。人数・時期は送る文と FinalDraft に入れる
  const trip = parseTrip(sp);
  const conditions = [...new Set([...picked, ...tripKeywords(trip)])];
  const [all, sheet, destTraits] = await Promise.all([planCards(locale), getAreaSheetData(locale), getDestTraits()]);
  const cards = all.filter((c) => inArea(c, area));
  // ルームの名前：エリアの名前（地区なら地区）と、選んだこだわりの名前
  const m = messages(locale);
  const areaLabel = sheet.areas.flatMap((g) => [g, ...g.subs]).find((x) => x.id === area)?.label ?? null;
  const name = proposalName(areaLabel, picked.map((k) => keywordOf(k)?.label ?? k), { all: m.plan.allAreas, sep: m.plan.nameSep, more: m.plan.nameMore });
  return {
    name,
    picked,
    area,
    trip: tripLabel(trip, { people: m.trip.peopleUnit, month: m.trip.month, option: m.trip.option, sep: m.trip.sep }),
    tripParams: tripQuery(trip),
    conditions,
    data: roomData(cards, conditions, sheet.traits, sheet.areas, destTraits),
  };
}
