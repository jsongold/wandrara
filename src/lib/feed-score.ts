// フィードの点数（#156）。dest ごとの「表示 1 回あたりの重み付きアクション」を、位置の偏りを補正し、少ない回数は種類の平均に寄せて均す。
// 重みと計算を変えたら FEED_WEIGHTS.version を上げる（feed-config の order=score の版になり、表示の記録で前後を比べられる）。
// 純粋関数。読み書きは feed-score-batch.ts が行う

export type FeedAction = "card_view" | "card_click" | "tile_click" | "save";

// dest × アクション × 位置 の回数。位置が無いもの（保存）は null
export type ActionCount = { destId: string; action: FeedAction; position: number | null; n: number };
export type ScoreTarget = { destId: string; coreType: string };

export type FeedWeights = {
  version: number;
  actions: Record<Exclude<FeedAction, "card_view">, number>;
  // 事前分布の強さ：位置で割り引いた表示回数がこの回数に届くまでは、種類の平均に寄る
  priorStrength: number;
};

// 初期案（#156）。旅の決定に近いほど重い。滞在時間・すぐ戻った・共有・外部へのクリックは、記録が入ってから足す
export const FEED_WEIGHTS: FeedWeights = {
  version: 1,
  actions: { card_click: 1, tile_click: 1.5, save: 8 },
  priorStrength: 20,
};

// 位置 p（0 始まり）が見られる見込み。上ほど見られる（位置の偏り）。1 / log2(p + 2)：0 位 1、1 位 0.63、6 位 0.33
export function examination(position: number): number {
  return 1 / Math.log2(Math.max(0, position) + 2);
}

export type ScoreResult = { scores: Map<string, number>; priors: Map<string, number> };

// 点数 = (重み付きアクション + k × 種類の平均) / (位置で割り引いた表示回数 + k)
// 表示が無い dest は種類の平均になる（新しい dest も真ん中あたりに出る）
export function scoreDests(targets: ScoreTarget[], counts: ActionCount[], weights: FeedWeights = FEED_WEIGHTS): ScoreResult {
  const coreOf = new Map(targets.map((t) => [t.destId, t.coreType]));
  const num = new Map<string, number>();
  const den = new Map<string, number>();
  for (const c of counts) {
    if (!coreOf.has(c.destId) || !(c.n > 0)) continue;
    if (c.action === "card_view") {
      den.set(c.destId, (den.get(c.destId) ?? 0) + c.n * examination(c.position ?? 0));
    } else {
      num.set(c.destId, (num.get(c.destId) ?? 0) + c.n * weights.actions[c.action]);
    }
  }

  const coreNum = new Map<string, number>();
  const coreDen = new Map<string, number>();
  for (const { destId, coreType } of targets) {
    coreNum.set(coreType, (coreNum.get(coreType) ?? 0) + (num.get(destId) ?? 0));
    coreDen.set(coreType, (coreDen.get(coreType) ?? 0) + (den.get(destId) ?? 0));
  }
  const priors = new Map<string, number>();
  for (const [core, d] of coreDen) priors.set(core, d > 0 ? coreNum.get(core)! / d : 0);

  const k = weights.priorStrength;
  const scores = new Map<string, number>();
  for (const { destId, coreType } of targets) {
    const mu = priors.get(coreType)!;
    scores.set(destId, ((num.get(destId) ?? 0) + k * mu) / ((den.get(destId) ?? 0) + k));
  }
  return { scores, priors };
}
