// エリア選択シートのデータをクライアントで取る（MS2c #110）。ページの間 1 度取ったら使い回す。
// 取得中・取得済みなら二重に取らない。失敗は上限つきで自動に再試行し（一時的な 5xx・通信断。4xx は直らないので再試行しない）、それでも駄目なら error にして、load をもう一度呼ぶとやり直す。React の useSyncExternalStore から読む。
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

// 取れなかった応答の状態。4xx は再試行しても直らない
export class HttpError extends Error {
  constructor(readonly status: number, url: string) {
    super(`${url}: ${status}`);
  }
}

type Options = { retries?: number; backoffMs?: number[]; sleep?: (ms: number) => Promise<void> };

export function createAreaSheetLoader(fetchJson: (url: string) => Promise<unknown>, opts: Options = {}) {
  const retries = opts.retries ?? 2;
  const backoff = opts.backoffMs ?? [400, 1200];
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  async function fetchWithRetry(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchJson(url);
      } catch (e) {
        const clientError = e instanceof HttpError && e.status >= 400 && e.status < 500;
        if (clientError || attempt >= retries) throw e;
        await sleep(backoff[attempt] ?? backoff.at(-1) ?? 0);
      }
    }
  }
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
      fetchWithRetry(`/api/area-sheet?lang=${locale}`).then(
        (data) => set(locale, { status: "ready", data: data as AreaSheetData }),
        () => set(locale, ERROR),
      );
    },
  };
}

export const areaSheetLoader = createAreaSheetLoader(async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json();
});
export const IDLE_AREA_SHEET = IDLE;
