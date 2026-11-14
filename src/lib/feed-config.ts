// 3 つの戦略を名前で選ぶ。環境変数で差し替えられ、UI は変えずに済む。
import { nearbyExperiences, orderEditorial, primaryByMode, relatedExperiences, type Strategies } from "./feed";

const ORDER = { editorial: orderEditorial };
const PRIMARY = { "by-mode": primaryByMode };
// nearby：場所と体験を距離で結ぶ（既定）。related-experiences：同じ地域の中で結ぶ（旧）
const SECONDARY = { nearby: nearbyExperiences, "related-experiences": relatedExperiences };

type Names = { order?: string; primary?: string; secondary?: string };

function pick<T>(table: Record<string, T>, name: string | undefined, fallback: string): T {
  return (name && table[name]) || table[fallback];
}

export function loadFeedStrategies(names: Names = {
  order: process.env.HOME_DEFAULT_ORDER,
  primary: process.env.PRIMARY_FEED_STRATEGY,
  secondary: process.env.SECONDARY_GRID_STRATEGY,
}): Strategies {
  return {
    order: pick(ORDER, names.order, "editorial"),
    primary: pick(PRIMARY, names.primary, "by-mode"),
    secondary: pick(SECONDARY, names.secondary, "nearby"),
  };
}
