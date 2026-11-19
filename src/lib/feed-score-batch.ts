// フィードの点数の batch（#156）：直近 FEED_SCORE_WINDOW_DAYS 日の記録を DB から読み、FEED_WEIGHTS で点数にして書き戻す。
// 何度走らせても同じ結果（全部を計算し直して置き換える）。scripts/feed-score.ts（pnpm feed:score）から走らせる
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEED_WEIGHTS, scoreDests, type ActionCount, type FeedAction, type FeedWeights } from "./feed-score.ts";

export const FEED_SCORE_WINDOW_DAYS = 90;
const ACTIONS: readonly FeedAction[] = ["card_view", "card_click", "tile_click", "save"];

type Inputs = {
  targets: { dest_id: string; core_type: string }[];
  counts: { dest_id: string; action: string; position: number | null; n: number }[];
};

export type FeedScoreBatchResult = { algorithm: string; targets: number; counts: number; scored: number };

export const scoreAlgorithm = (w: FeedWeights) => `order=score@${w.version}`;

export async function runFeedScoreBatch(db: SupabaseClient, now: Date = new Date(), weights: FeedWeights = FEED_WEIGHTS): Promise<FeedScoreBatchResult> {
  const since = new Date(now.getTime() - FEED_SCORE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await db.rpc("feed_score_inputs", { p_since: since });
  if (error) throw new Error(`feed_score_inputs: ${error.message}`);
  const inputs = data as Inputs;

  const counts: ActionCount[] = inputs.counts
    .filter((c) => (ACTIONS as readonly string[]).includes(c.action))
    .map((c) => ({ destId: c.dest_id, action: c.action as FeedAction, position: c.position, n: Number(c.n) }));
  const { scores, priors } = scoreDests(
    inputs.targets.map((t) => ({ destId: t.dest_id, coreType: t.core_type })),
    counts,
    weights,
  );

  const algorithm = scoreAlgorithm(weights);
  const { data: scored, error: applyError } = await db.rpc("feed_scores_apply", {
    p_scores: [...scores].map(([dest_id, score]) => ({ dest_id, score })),
    p_priors: [...priors].map(([core_type, score]) => ({ core_type, score })),
    p_algorithm: algorithm,
  });
  if (applyError) throw new Error(`feed_scores_apply: ${applyError.message}`);
  return { algorithm, targets: inputs.targets.length, counts: counts.length, scored: Number(scored) };
}
