// フィードの記録の送り先（#156）：/api/feed/events にまとめて送る。setFeedEventSink に渡す。
// 点数の batch に要るもの（card_view・card_click・tile_click）だけを送る。feed_view は送らない。
// 送るのは、FEED_EVENTS_MAX 件たまったとき・最後の記録から FLUSH_MS たったとき・画面が隠れたとき（閉じる・別のタブ・アプリの切り替え）。
// 画面が隠れたときは fetch が途中で切られることがあるので sendBeacon を使う
import type { FeedEventRecord, FeedEventSink } from "./feed-events";

export const FEED_EVENTS_MAX = 50;
export const FEED_EVENTS_PATH = "/api/feed/events";
const FLUSH_MS = 5000;

type Sent = Extract<FeedEventRecord, { name: "card_view" | "card_click" | "tile_click" }>;
export type FeedEventPayload = { sessionId: string; events: Omit<Sent, "q">[] };

export type BeaconDeps = {
  sessionId: string;
  send: (payload: FeedEventPayload) => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

// 送る分だけを、送る形にする（検索語 q は送らない）
export function toSent(r: FeedEventRecord): Omit<Sent, "q"> | null {
  if (r.name !== "card_view" && r.name !== "card_click" && r.name !== "tile_click") return null;
  const rest: Omit<Sent, "q"> & { q?: string } = { ...r };
  delete rest.q;
  return rest;
}

export function createBeaconSink(deps: BeaconDeps): { sink: FeedEventSink; flush: () => void } {
  let buf: Omit<Sent, "q">[] = [];
  let timer: unknown = null;

  const flush = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    if (buf.length === 0) return;
    const events = buf;
    buf = [];
    deps.send({ sessionId: deps.sessionId, events });
  };

  const sink: FeedEventSink = (r) => {
    const e = toSent(r);
    if (!e) return;
    buf.push(e);
    if (buf.length >= FEED_EVENTS_MAX) return flush();
    if (timer !== null) deps.clearTimer(timer);
    timer = deps.setTimer(flush, FLUSH_MS);
  };

  return { sink, flush };
}

function sendBeaconOrFetch(payload: FeedEventPayload): void {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.(FEED_EVENTS_PATH, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // sendBeacon が使えない・断られたときは fetch にする
  }
  fetch(FEED_EVENTS_PATH, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

// ページを開いてから閉じるまでの 1 回を 1 session とする（画面の切り替えで HomeScreen が作り直されても同じ）
let pageSessionId: string | null = null;

// ブラウザで送り先をつなぐ。戻り値で外す（送り残しはそのとき送る）。randomUUID が無い（http の開発環境など）ときはつながない
export function installFeedEventBeacon(setSink: (s: FeedEventSink | null) => void): () => void {
  if (typeof crypto?.randomUUID !== "function") return () => {};
  pageSessionId ??= crypto.randomUUID();
  const { sink, flush } = createBeaconSink({
    sessionId: pageSessionId,
    send: sendBeaconOrFetch,
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (h) => window.clearTimeout(h as number),
  });
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  setSink(sink);
  return () => {
    setSink(null);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
    flush();
  };
}
