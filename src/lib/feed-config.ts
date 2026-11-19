// 3 つの戦略を名前で選ぶ。環境変数で差し替えられ、UI は変えずに済む。
// 戦略の中身（並び・選び方）を変えたら version を上げる。表示ログで前後を比べられるようにするため
import { orderEditorial, primaryByMode, relatedAnyKind, relatedOtherMode, type Strategies } from "./feed";
import { FEED_WEIGHTS } from "./feed-score";

type Entry<T> = { version: number; run: T; dbOnly?: boolean };

// score：点数（#156）の順。点数は DB（feed_entries.score）にしか無いので、DB 版（feed_page）だけで出せる。
// 版は重みの版（FEED_WEIGHTS.version）。重みや計算を変えたら上がる
const ORDER = {
  editorial: { version: 1, run: orderEditorial },
  score: { version: FEED_WEIGHTS.version, run: orderEditorial, dbOnly: true },
};
const DEFAULT_PRIMARY = "by-mode";
const DEFAULT_SECONDARY = "related-any-kind";
const PRIMARY = { "by-mode": { version: 2, run: primaryByMode } };
const SECONDARY = {
  "related-other-mode": { version: 1, run: relatedOtherMode },
  "related-any-kind": { version: 1, run: relatedAnyKind },
};

type Names = { order?: string; primary?: string; secondary?: string };

function pick<T>(table: Record<string, Entry<T>>, name: string | undefined, fallback: string): Entry<T> & { name: string } {
  const key = name && table[name] ? name : fallback;
  return { name: key, ...table[key] };
}

const label = (stage: string, e: { name: string; version: number }) => `${stage}=${e.name}@${e.version}`;

export function loadFeedStrategies(names: Names = {
  order: process.env.HOME_DEFAULT_ORDER,
  primary: process.env.PRIMARY_FEED_STRATEGY,
  secondary: process.env.SECONDARY_GRID_STRATEGY,
}): Strategies {
  const primary = pick<Strategies["primary"]>(PRIMARY, names.primary, DEFAULT_PRIMARY);
  const secondary = pick<Strategies["secondary"]>(SECONDARY, names.secondary, DEFAULT_SECONDARY);
  // DB 版だけの並び（score）は、メイン・関連タイルが既定のときだけ選べる。それ以外は全件版（buildFeed）になるので編集部の順に戻す
  const dbPath = primary.name === DEFAULT_PRIMARY && secondary.name === DEFAULT_SECONDARY;
  let order = pick<Strategies["order"]>(ORDER, names.order, "editorial");
  if (order.dbOnly && !dbPath) order = pick<Strategies["order"]>(ORDER, "editorial", "editorial");
  return {
    id: [label("order", order), label("primary", primary), label("secondary", secondary)].join(" "),
    order: order.run,
    primary: primary.run,
    secondary: secondary.run,
  };
}
