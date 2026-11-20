// 提案フェーズのエンジン。外から使うのはここに出しているものだけ。
// 流れ：状態 → preference（好みの重み）→ picker（次の候補）→ chooser（選択肢）→ lead（一言）→ 1 回分の結果
import { entropyChooser } from "./choices";
import { templateLead, type LeadText } from "./lead";
import { mmrPicker } from "./pick";
import { additivePreference } from "./preference";
import type { FeatureId, Strategies } from "./types";

export type * from "./types";
export { additivePreference, PREFERENCE_V1 } from "./preference";
export { mmrPicker, MMR_V1 } from "./pick";
export { entropyChooser, ENTROPY_V1 } from "./choices";
export { templateLead, guardedLead, type LeadText } from "./lead";
export { nextRound, initialState, applyRound, applyReaction, applyChoice, allReacted, reactionCause, algorithmOf } from "./round";
export { toCandidates, conditionFeatures, featureLabeler, type FeatureLabels } from "./features";

/** 今の既定の戦略（v1）。差し替えるときは一部だけ上書きして渡す */
export function defaultStrategies(text: LeadText, labelOf: (f: FeatureId) => string): Strategies {
  return { preference: additivePreference(), picker: mmrPicker(), chooser: entropyChooser(), lead: templateLead(text, labelOf) };
}
