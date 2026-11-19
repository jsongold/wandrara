// フィードの点数を計算し直して書く（#156）。直近 90 日の feed_events と保存を数え、feed_scores と feed_entries.score を置き換える。
// 使い方: pnpm feed:score   環境変数 NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY（.env.local でもよい）
// 何度走らせても同じ結果。並びに使われるのは HOME_DEFAULT_ORDER=score のときだけ
import { runFeedScoreBatch } from "../src/lib/feed-score-batch.ts";
import { adminClient } from "../src/lib/supabase/admin.ts";

try {
  const r = await runFeedScoreBatch(adminClient());
  console.log(`${r.algorithm}: dest ${r.targets} 件に点数を書いた（${r.scored} 件）。数えた組 ${r.counts}`);
} catch (e) {
  console.error(`error: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
}
