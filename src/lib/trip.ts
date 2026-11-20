// 旅の目的：人数・時期（月）・そのほか（ペット・バリアフリー・子ども・ひとり）。目的シートで選び、提案ページの URL（?p=&m=&o=）で渡す（純関数）。
// そのほかは dest_traits の特徴（犬と泊まれる など）、時期は季節の特徴として提案の条件に足す。人数と時期は送る文と FinalDraft にも入れる
export type TripOption = "pets" | "barrier_free" | "kids" | "solo";

/** そのほか → 条件にするキーワード（dest_traits の特徴 id） */
export const TRIP_OPTIONS: { id: TripOption; keyword: string }[] = [
  { id: "pets", keyword: "dogs_ok" },
  { id: "barrier_free", keyword: "wheelchair" },
  { id: "kids", keyword: "kids_ok" },
  { id: "solo", keyword: "solo_ok" },
];

/** people・month は未定なら null。month は 1〜12 */
export type Trip = { people: number | null; month: number | null; options: TripOption[] };
export const EMPTY_TRIP: Trip = { people: null, month: null, options: [] };
export const MAX_PEOPLE = 20;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const intIn = (v: string | undefined, min: number, max: number): number | null => {
  const n = v && /^\d{1,2}$/.test(v) ? Number(v) : NaN;
  return n >= min && n <= max ? n : null;
};

export function parseTrip(sp: Record<string, string | string[] | undefined>): Trip {
  const known = new Set(TRIP_OPTIONS.map((o) => o.id));
  const options = [...new Set((first(sp.o) ?? "").split(","))].filter((x): x is TripOption => known.has(x as TripOption));
  return { people: intIn(first(sp.p), 1, MAX_PEOPLE), month: intIn(first(sp.m), 1, 12), options };
}

/** URL に足す値（未定のものは入れない） */
export function tripQuery(trip: Trip): Record<string, string> {
  return {
    ...(trip.people ? { p: String(trip.people) } : {}),
    ...(trip.month ? { m: String(trip.month) } : {}),
    ...(trip.options.length ? { o: trip.options.join(",") } : {}),
  };
}

/** 季節の特徴：10・11 月は紅葉、12〜2 月は雪景色 */
export function seasonKeywords(month: number | null): string[] {
  if (month === 10 || month === 11) return ["autumn_leaves"];
  if (month === 12 || month === 1 || month === 2) return ["snow_scenery"];
  return [];
}

/** 提案の条件に足すキーワード（そのほか ＋ 季節） */
export function tripKeywords(trip: Trip): string[] {
  return [...trip.options.map((o) => TRIP_OPTIONS.find((x) => x.id === o)!.keyword), ...seasonKeywords(trip.month)];
}

/** 今の月から n か月（例：11 月なら 11・12・1・2・3・4） */
export function monthsAhead(now: Date, n = 6): number[] {
  return Array.from({ length: n }, (_, i) => ((now.getMonth() + i) % 12) + 1);
}

export const isEmptyTrip = (t: Trip): boolean => !t.people && !t.month && !t.options.length;

/** 目的の短い名前。words は言語ごとの文言 */
export function tripLabel(trip: Trip, words: { people: (n: number) => string; month: (m: number) => string; option: Record<TripOption, string>; sep: string }): string {
  return [trip.people ? words.people(trip.people) : null, trip.month ? words.month(trip.month) : null, ...trip.options.map((o) => words.option[o])].filter(Boolean).join(words.sep);
}
