// 1 回分の提案を作る（純関数）と、ルームの状態の更新。戦略は差し替えられる（strategies）
import type { Reaction } from "../reactions";
import { react } from "../reactions";
import type { Candidate, Cause, FeatureId, ProposeState, RoundResult, Strategies, Weights } from "./types";

export const initialState = (conditions: FeatureId[]): ProposeState => ({ conditions, reactions: {}, choices: [], shown: [], round: 0 });

/** 使った戦略の名前と版（記録・A/B 用） */
export const algorithmOf = (s: Strategies): string => [s.goal?.name, s.preference.name, s.picker.name, s.chooser.name, s.lead.name].filter(Boolean).join(" ");

/** 選んだ候補に一番効いた特徴（重みが正のもので、重み × 持っている数が最大） */
export function topFeature(picked: Candidate[], w: Weights): FeatureId | null {
  const sum = new Map<FeatureId, number>();
  for (const c of picked) for (const f of new Set(c.features)) if ((w.get(f) ?? 0) > 0) sum.set(f, (sum.get(f) ?? 0) + w.get(f)!);
  let best: FeatureId | null = null;
  for (const [f, v] of sum) if (best === null || v > sum.get(best)!) best = f;
  return best;
}

/**
 * 次の回：出していない・うーんでない候補から選び、残りから選択肢を作り、一言を付ける。
 * ゴールがあれば、候補を次に埋める枠に向け（focus）、重みを足す（boost）。ゴールが埋まっていれば候補は出さない（goal.complete）
 */
export function nextRound(state: ProposeState, cause: Cause, all: Candidate[], s: Strategies): RoundResult {
  const byId = new Map(all.map((c) => [c.id, c]));
  const ctx = { state, featuresOf: (id: string) => byId.get(id)?.features ?? [] };
  const goal = s.goal?.status(state, all);
  const w = goal && s.goal ? s.goal.boost(s.preference.weigh(ctx), goal, ctx.featuresOf) : s.preference.weigh(ctx);
  const shown = new Set(state.shown);
  const pool = all.filter((c) => !shown.has(c.id) && state.reactions[c.id] !== "hmm");
  const focused = goal && s.goal ? s.goal.focus(pool, goal) : pool;
  const ids = goal?.complete ? [] : s.picker.pick(focused, w, ctx);
  const chosen = new Set(ids);
  const choices = s.chooser.choose(focused.filter((c) => !chosen.has(c.id)), w, ctx);
  const picked = ids.map((id) => byId.get(id)!);
  const stayName = goal?.stay ? (byId.get(goal.stay)?.name ?? null) : null;
  const leadInput = { cause, picked, topFeature: topFeature(picked, w), goal, stayName };
  return { ids, lead: s.lead.write(leadInput), leadInput, choices, algorithm: algorithmOf(s), done: ids.length === 0 && !goal?.complete, goal };
}

// ---- 状態の更新 ----

/** 出した回を状態に入れる */
export const applyRound = (state: ProposeState, r: RoundResult): ProposeState =>
  r.done ? state : { ...state, shown: [...state.shown, ...r.ids], round: state.round + 1 };

/** リアクション（同じものなら外す） */
export const applyReaction = (state: ProposeState, id: string, r: Reaction): ProposeState => ({ ...state, reactions: react(state.reactions, id, r) });

/** 選択肢を選ぶ（今の回に選んだことにする） */
export const applyChoice = (state: ProposeState, feature: FeatureId): ProposeState => ({ ...state, choices: [...state.choices, { feature, round: state.round }] });

/** その回の候補すべてにリアクションしたか（次の回と選択肢を出す合図） */
export const allReacted = (state: ProposeState, ids: string[]): boolean => ids.length > 0 && ids.every((id) => state.reactions[id]);

/** リアクションで次の回を出すときのきっかけ：すごくいい → うーん → いいね の順で、その回の最初のもの */
export function reactionCause(state: ProposeState, ids: string[], nameOf: (id: string) => string): Cause {
  for (const r of ["great", "hmm", "good"] as const) {
    const id = ids.find((x) => state.reactions[x] === r);
    if (id) return { type: "reaction", reaction: r, id, name: nameOf(id) };
  }
  return { type: "next" };
}
