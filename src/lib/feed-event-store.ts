// フィードの記録（app log。件数が多い）の書き先（#156）。/api/feed/events が受けた行をここに渡す。
// 書き先は環境変数 FEED_EVENTS_STORE で選ぶ（既定 supabase）。別の書き先（PostHog・ログ基盤など）は STORES に 1 つ足すだけで、画面と API は変えない。
// 書き先を変えたら、点数の batch の読み元（feed-score-source）も同じ所に向ける
import { adminClient } from "./supabase/admin.ts";

export type FeedEventRow = {
  name: "card_view" | "card_click" | "tile_click";
  dest_id: string;
  position: number;
  from_dest_id: string | null;
  session_id: string;
  algorithm: string;
  mode: string;
  sort: string;
  area: string;
  cat: string;
};

export type FeedEventStore = { name: string; write: (rows: FeedEventRow[]) => Promise<void> };

// Supabase の feed_events に書く（サーバーのキー）
const supabaseStore = (): FeedEventStore => ({
  name: "supabase",
  write: async (rows) => {
    const { error } = await adminClient().from("feed_events").insert(rows);
    if (error) throw new Error(`feed_events: ${error.message}`);
  },
});

// 書かない（記録を止めたいとき・開発環境）
const noneStore = (): FeedEventStore => ({ name: "none", write: async () => {} });

const STORES: Record<string, () => FeedEventStore> = { supabase: supabaseStore, none: noneStore };
export const FEED_EVENT_STORES = Object.keys(STORES);

// 知らない名前は黙って既定にせず throw する（書き先の打ち間違いで記録が別の所へ行かないように）
export function loadFeedEventStore(name: string | undefined = process.env.FEED_EVENTS_STORE): FeedEventStore {
  const key = name || "supabase";
  const make = STORES[key];
  if (!make) throw new Error(`FEED_EVENTS_STORE=${key} は無い（${FEED_EVENT_STORES.join(" / ")}）`);
  return make();
}
