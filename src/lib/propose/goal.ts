// 提案のゴール：Fix できるプラン（宿 1 件 ＋ 体験 activities 件）を埋めること。
// 毎回の候補は「まだ埋まっていない枠」に向ける。宿が決まったら、その宿と同じ地区の体験を先にする
import type { Candidate, FeatureId, Goal, GoalStatus, ProposeState, Slot, Weights } from "./types";

export type GoalConfig = { activities: number; nearStay: number };
export const GOAL_V1: GoalConfig = { activities: 2, nearStay: 2 };

const STAY = "kind:accommodation";
export const slotOf = (c: Pick<Candidate, "features">): Slot => (c.features.includes(STAY) ? "stay" : "activity");
const areaOf = (c: Pick<Candidate, "features">): FeatureId | null => c.features.find((f) => f.startsWith("area:")) ?? null;

/** 枠を埋めているもの：その枠の候補のうち、すごくいい → いいね の順。同じなら先に出したもの */
export function goalStatus(state: ProposeState, all: Candidate[], cfg: GoalConfig = GOAL_V1): GoalStatus {
  const byId = new Map(all.map((c) => [c.id, c]));
  const rank = (id: string) => (state.reactions[id] === "great" ? 0 : state.reactions[id] === "good" ? 1 : 9);
  const liked = state.shown
    .filter((id) => rank(id) < 9 && byId.has(id))
    .map((id, i) => ({ id, i, r: rank(id) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => byId.get(x.id)!);
  const stay = liked.find((c) => slotOf(c) === "stay")?.id ?? null;
  const activities = liked.filter((c) => slotOf(c) === "activity").slice(0, cfg.activities).map((c) => c.id);
  const target: Slot | null = !stay ? "stay" : activities.length < cfg.activities ? "activity" : null;
  return { stay, activities, target, complete: target === null };
}

export function planGoal(cfg: GoalConfig = GOAL_V1, name = "goal-plan@1"): Goal {
  return {
    name,
    status: (state, all) => goalStatus(state, all, cfg),
    /** 埋まっていない枠の候補だけにする。その枠の候補が尽きていたら、ほかの枠も出す（止まらないように） */
    focus(pool, status) {
      if (!status.target) return pool;
      const inSlot = pool.filter((c) => slotOf(c) === status.target);
      return inSlot.length ? inSlot : pool;
    },
    /** 宿が決まったら、宿と同じ地区に重みを足す */
    boost(w: Weights, status, featuresOf) {
      const area = status.stay ? areaOf({ features: featuresOf(status.stay) }) : null;
      if (!area || status.target !== "activity") return w;
      const out = new Map(w);
      out.set(area, (out.get(area) ?? 0) + cfg.nearStay);
      return out;
    },
  };
}
