// dest の紹介文から特徴を判定するときの、プロンプトの組み立て・応答の検査・一致率（純関数。API は呼ばない）
import { appliesTo, type TraitDef } from "./trait-defs.ts";

/** 最初に判定する 30 件（作り方が紹介文の flag）。提案の選択肢として効きそうなものを、大分類が偏らないように選んだ */
export const PICKED_TRAIT_IDS = [
  // 静けさ・誰と
  "quiet", "digital_detox", "solo_ok", "kids_ok", "couples", "dogs_ok",
  // 立地・自然
  "sea_view", "peak_view", "stargazing", "primeval_forest", "autumn_leaves", "snow_scenery",
  // 温泉・風呂
  "rotenburo", "private_bath", "kakenagashi", "sauna", "room_rotenburo",
  // 宿の形・雰囲気
  "one_group", "mood_cozy", "mood_traditional", "kominka",
  // 食
  "local_food", "room_dining",
  // 働く・アクセシビリティ
  "workation", "wheelchair",
  // 過ごし方・体験の形・文化
  "walking", "cycling", "tea_ceremony", "beginner_ok", "english_ok",
] as const;

export const MIN_CONFIDENCE = 0.5;

export type DestText = { destId: string; coreType: string; name: string; summary: string };
export type Judgement = { traitId: string; evidence: string; confidence: number };
export type Reject = { traitId: string | null; reason: string };

/** その dest に尋ねる特徴（対象が合うもの） */
export function traitsFor(dest: Pick<DestText, "coreType">, defs: TraitDef[]): TraitDef[] {
  return defs.filter((d) => appliesTo(d.target, dest.coreType));
}

/** 根拠の文を探す元の文章。プロンプトにもこれをそのまま入れる */
export function sourceText(dest: Pick<DestText, "name" | "summary">): string {
  return `名前: ${dest.name}\n紹介文: ${dest.summary}`;
}

const SYSTEM = [
  "あなたは旅行の場所（宿・体験・自然・建物・温泉）の紹介文から、特徴を判定する。",
  "規則:",
  "- 紹介文に書いてあることだけを根拠にする。書いていないことは推測しない。一般常識や、名前から連想した事柄で補わない。",
  "- 当てはまると言える特徴だけを results に入れる。根拠が無い・言い切れない特徴は入れない（入れないことが「分からない」の答え）。",
  "- evidence は紹介文（名前を含む）からそのまま写した部分。要約・言い換えをしない。",
  "- confidence は 0 から 1。紹介文がはっきり言っているほど高い。",
  '- 出力は JSON だけ。形は {"results":[{"trait_id":"...","evidence":"...","confidence":0.9}]}。当てはまるものが無ければ {"results":[]}。',
].join("\n");

export function buildPrompt(dest: DestText, traits: Pick<TraitDef, "id" | "name">[]): { system: string; user: string } {
  const list = traits.map((t) => `- ${t.id}: ${t.name}`).join("\n");
  return {
    system: SYSTEM,
    user: `場所の種類: ${dest.coreType}\n${sourceText(dest)}\n\n判定する特徴（id: 名前）:\n${list}`,
  };
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** モデルの応答（文字列）を検査する。形・id・根拠の引用・confidence が正しいものだけ accepted にし、残りは理由つきで rejected */
export function parseResponse(raw: string, dest: DestText, asked: Pick<TraitDef, "id">[]): { accepted: Judgement[]; rejected: Reject[] } {
  const rejected: Reject[] = [];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  let results: unknown;
  try {
    if (start < 0 || end < start) throw new Error("no json");
    results = (JSON.parse(raw.slice(start, end + 1)) as { results?: unknown }).results;
  } catch {
    return { accepted: [], rejected: [{ traitId: null, reason: "JSON として読めない" }] };
  }
  if (!Array.isArray(results)) return { accepted: [], rejected: [{ traitId: null, reason: "results が配列ではない" }] };

  const askedIds = new Set(asked.map((t) => t.id));
  const haystack = norm(sourceText(dest));
  const accepted: Judgement[] = [];
  const seen = new Set<string>();
  for (const r of results as Record<string, unknown>[]) {
    const id = typeof r?.trait_id === "string" ? r.trait_id : null;
    if (!id || !askedIds.has(id)) {
      rejected.push({ traitId: id, reason: "尋ねていない特徴" });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ traitId: id, reason: "重複" });
      continue;
    }
    const evidence = typeof r.evidence === "string" ? r.evidence.trim() : "";
    if (norm(evidence).length < 2) {
      rejected.push({ traitId: id, reason: "根拠が無い" });
      continue;
    }
    if (!haystack.includes(norm(evidence))) {
      rejected.push({ traitId: id, reason: "根拠が紹介文に無い（引用でない）" });
      continue;
    }
    const c = r.confidence;
    if (typeof c !== "number" || !(c >= 0 && c <= 1)) {
      rejected.push({ traitId: id, reason: "confidence が 0〜1 の数でない" });
      continue;
    }
    if (c < MIN_CONFIDENCE) {
      rejected.push({ traitId: id, reason: `confidence が ${MIN_CONFIDENCE} 未満` });
      continue;
    }
    seen.add(id);
    accepted.push({ traitId: id, evidence, confidence: c });
  }
  return { accepted, rejected };
}

/** 2 つの判定（dest × 特徴 → 値が付いたか）の一致 */
export type Compared = { destId: string; traitId: string; a: boolean; b: boolean };

export function agreement(pairs: Compared[]): { total: number; agree: number; rate: number | null; aTrue: { total: number; agree: number } } {
  const agree = pairs.filter((p) => p.a === p.b).length;
  const aTrue = pairs.filter((p) => p.a);
  return {
    total: pairs.length,
    agree,
    rate: pairs.length === 0 ? null : agree / pairs.length,
    // a（Haiku）が「付ける」とした組のうち、b（Sonnet）も付けたもの（保存される値の確からしさ）
    aTrue: { total: aTrue.length, agree: aTrue.filter((p) => p.b).length },
  };
}

/** 重複なしで n 個を選ぶ。rng は 0 以上 1 未満の乱数（テストでは固定する） */
export function sample<T>(items: T[], n: number, rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** 確認用の標本：「付いた」組と「付かなかった」組を半々に（付いた組が少なければ全部。足りない分は付かなかった組で埋める） */
export function pickVerifySample<T extends { a: boolean }>(pairs: T[], n: number, rng: () => number = Math.random): T[] {
  const pos = pairs.filter((p) => p.a);
  const neg = pairs.filter((p) => !p.a);
  const posN = Math.min(pos.length, Math.ceil(n / 2));
  const negN = Math.min(neg.length, n - posN);
  const posMore = Math.min(pos.length - posN, n - posN - negN);
  const chosen = [...sample(pos, posN + posMore, rng), ...sample(neg, negN, rng)];
  return chosen;
}
