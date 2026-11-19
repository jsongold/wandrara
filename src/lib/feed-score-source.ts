// 点数の batch の読み元（#156）：点数を付ける dest と、dest × アクション × 位置 の回数をどこから読むか。
// 環境変数 FEED_SCORE_SOURCE で選ぶ（既定 supabase）。記録の書き先（FEED_EVENTS_STORE）を変えたら、ここにも同じ所から読む読み元を足して向ける。
// 点数の書き込み先は DB のまま（feed_page が並びに使う）
import type { SupabaseClient } from "@supabase/supabase-js";

export type ScoreInputs = {
  targets: { dest_id: string; core_type: string }[];
  counts: { dest_id: string; action: string; position: number | null; n: number | string }[];
};

export type FeedScoreSource = { name: string; load: (since: string) => Promise<ScoreInputs> };

// feed_events と user_saves を DB の中で数える（feed_score_inputs）
const supabaseSource = (db: SupabaseClient): FeedScoreSource => ({
  name: "supabase",
  load: async (since) => {
    const { data, error } = await db.rpc("feed_score_inputs", { p_since: since });
    if (error) throw new Error(`feed_score_inputs: ${error.message}`);
    return data as ScoreInputs;
  },
});

const SOURCES: Record<string, (db: SupabaseClient) => FeedScoreSource> = { supabase: supabaseSource };

export function loadFeedScoreSource(db: SupabaseClient, name: string | undefined = process.env.FEED_SCORE_SOURCE): FeedScoreSource {
  const key = name || "supabase";
  const make = SOURCES[key];
  if (!make) throw new Error(`FEED_SCORE_SOURCE=${key} は無い（${Object.keys(SOURCES).join(" / ")}）`);
  return make(db);
}
