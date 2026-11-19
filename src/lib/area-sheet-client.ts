// エリア選択シートのデータをクライアントで取る（MS2c #110）。ページの間 1 度取ったら使い回す。
// 取得中・取得済みなら二重に取らない。失敗したら error にして、load をもう一度呼ぶとやり直す。React の useSyncExternalStore から読む。
import type { AreaSheetData } from "./area-sheet";
import type { Locale } from "./types";

export type AreaSheetState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: AreaSheetData }
  | { status: "error" };

const IDLE: AreaSheetState = { status: "idle" };
const LOADING: AreaSheetState = { status: "loading" };
const ERROR: AreaSheetState = { status: "error" };

export function createAreaSheetLoader(fetchJson: (url: string) => Promise<unknown>) {
  const states = new Map<Locale, AreaSheetState>();
  const listeners = new Set<() => void>();
  const set = (locale: Locale, s: AreaSheetState) => {
    states.set(locale, s);
    for (const l of listeners) l();
  };
  return {
    get: (locale: Locale): AreaSheetState => states.get(locale) ?? IDLE,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    load(locale: Locale): void {
      const s = states.get(locale);
      if (s?.status === "loading" || s?.status === "ready") return;
      set(locale, LOADING);
      fetchJson(`/api/area-sheet?lang=${locale}`).then(
        (data) => set(locale, { status: "ready", data: data as AreaSheetData }),
        () => set(locale, ERROR),
      );
    },
  };
}

export const areaSheetLoader = createAreaSheetLoader(async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
});
export const IDLE_AREA_SHEET = IDLE;
