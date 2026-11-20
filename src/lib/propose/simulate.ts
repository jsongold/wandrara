// 提案ルームを決まった振る舞いの利用者で最後まで動かす（純関数。評価に使う）。
// 利用者：各回の 1 件目に「すごくいい」、残りに「うーん」（＝出された順の 1 件目をいつも選ぶ人）。ゴールがそろうか、回の上限で止める
import { applyReaction, applyRound, initialState, nextRound, reactionCause } from "./round";
import type { Candidate, Cause, FeatureId, GoalStatus, Strategies } from "./types";

export type SimRound = { cause: Cause["type"]; lead: string; ids: string[] };
export type Simulation = { rounds: SimRound[]; goal: GoalStatus | null; roundsToPlan: number | null; algorithm: string };

export function simulate(candidates: Candidate[], conditions: FeatureId[], s: Strategies, maxRounds = 8): Simulation {
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? id;
  let state = initialState(conditions);
  let cause: Cause = { type: "start" };
  const rounds: SimRound[] = [];
  let algorithm = "";
  for (let i = 0; i < maxRounds; i++) {
    const r = nextRound(state, cause, candidates, s);
    algorithm = r.algorithm;
    if (r.goal?.complete) return { rounds, goal: r.goal, roundsToPlan: rounds.length, algorithm };
    if (r.done) break;
    rounds.push({ cause: cause.type, lead: r.lead, ids: r.ids });
    state = applyRound(state, r);
    r.ids.forEach((id, k) => (state = applyReaction(state, id, k === 0 ? "great" : "hmm")));
    cause = reactionCause(state, r.ids, nameOf);
  }
  return { rounds, goal: s.goal?.status(state, candidates) ?? null, roundsToPlan: null, algorithm };
}
