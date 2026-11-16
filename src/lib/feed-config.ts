// 3 つの戦略を名前で選ぶ。環境変数で差し替えられ、UI は変えずに済む。
// 戦略の中身（並び・選び方）を変えたら version を上げる。表示ログで前後を比べられるようにするため
import { orderEditorial, primaryByMode, relatedOtherMode, type Strategies } from "./feed";

type Entry<T> = { version: number; run: T };

const ORDER = { editorial: { version: 1, run: orderEditorial } };
const PRIMARY = { "by-mode": { version: 1, run: primaryByMode } };
const SECONDARY = { "related-other-mode": { version: 1, run: relatedOtherMode } };

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
  const order = pick<Strategies["order"]>(ORDER, names.order, "editorial");
  const primary = pick<Strategies["primary"]>(PRIMARY, names.primary, "by-mode");
  const secondary = pick<Strategies["secondary"]>(SECONDARY, names.secondary, "related-other-mode");
  return {
    id: [label("order", order), label("primary", primary), label("secondary", secondary)].join(" "),
    order: order.run,
    primary: primary.run,
    secondary: secondary.run,
  };
}
