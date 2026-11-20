// 提案の評価の結果をまとめる（純関数）。主役は「そのグループ・人に合った経験を提案できたか」（Agent の採点 fit）。
// 機械の指標（合う割合・候補の数など）は参考。採点の指示の組み立て・Agent の返事の読み取り・前回との比較の表を作る
import type { EvalMetrics } from "../../src/lib/propose-eval.ts";

/** features は場所そのものの特徴、areaTraits は地区の特性（地区の場所すべてに付く。その場所にあるとは限らない） */
export type Card = { name: string; kind: string; area: string; features: string[]; areaTraits: string[] };

/** Agent の採点（シナリオ 1 つ分） */
export type Judge = {
  /** このグループに合う経験か（1〜5） */
  fit: number;
  reason: string;
  /** 回ごとの fit（1〜5） */
  rounds: number[];
  /** 足りないもの */
  missing: string[];
  /** 入れるべきでなかったもの */
  wrong: string[];
};

export type ScenarioResult = {
  id: string;
  who: string;
  want: string;
  query: Record<string, string>;
  /** /api/propose-eval の返り値（失敗したら error） */
  result?: {
    name: string;
    trip: string;
    conditions: string[];
    algorithm: string;
    metrics: EvalMetrics;
    rounds: { cause: string; lead: string; cards: Card[] }[];
    plan: string[];
  };
  error?: string;
  judge?: Judge;
};

export type Run = { at: string; base: string; algorithm: string; scenarios: ScenarioResult[]; judgedAt?: string };

type Metric = { key: string; label: string; better: "high" | "low"; value: (m: EvalMetrics) => number | null };

/** 参考の機械の指標。better は良い向き（日程の指標は今は扱わない） */
export const METRICS: Metric[] = [
  { key: "fit", label: "条件に合う割合", better: "high", value: (m) => m.fit },
  { key: "placeFit", label: "場所で合う割合", better: "high", value: (m) => m.placeFit },
  { key: "reasonTruth", label: "理由が場所の特徴", better: "high", value: (m) => m.reasonTruth },
  { key: "variety", label: "地区のばらつき", better: "high", value: (m) => m.variety },
  { key: "pool", label: "候補の数", better: "high", value: (m) => m.pool },
  { key: "dropped", label: "捨てた条件の数", better: "low", value: (m) => m.dropped.length },
  { key: "planRate", label: "プランがそろう", better: "high", value: (m) => (m.roundsToPlan === null ? 0 : 1) },
  { key: "tapsToPlan", label: "プランまでのタップ", better: "low", value: (m) => m.tapsToPlan },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** 採点した fit の平均（採点が無ければ null） */
export const fitMean = (run: Run): number | null => mean(run.scenarios.map((s) => s.judge?.fit));

/** 機械の指標ごとの全シナリオの平均（値が無いシナリオは除く） */
export function summarize(run: Run): Record<string, number | null> {
  const ms = run.scenarios.flatMap((s) => (s.result ? [s.result.metrics] : []));
  return Object.fromEntries(METRICS.map((x) => [x.key, mean(ms.map(x.value))]));
}

/** fit の低い順に n 個（採点の無いシナリオは除く） */
export function worstByFit(run: Run, n = 3): ScenarioResult[] {
  return run.scenarios
    .filter((s) => s.judge)
    .sort((a, b) => a.judge!.fit - b.judge!.fit)
    .slice(0, n);
}

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "-" : String(v));
const has = (v: number | null | undefined): v is number => typeof v === "number";

/** 差の判定：良くなった / 悪くなった / 同じ。どちらかが無ければ空 */
export function verdict(better: "high" | "low", prev: number | null | undefined, cur: number | null | undefined): string {
  if (!has(prev) || !has(cur)) return "";
  if (prev === cur) return "同じ";
  return cur > prev === (better === "high") ? "良くなった" : "悪くなった";
}

const diff = (prev: number | null | undefined, cur: number | null | undefined) =>
  !has(prev) || !has(cur) ? "" : cur === prev ? "0" : `${cur > prev ? "+" : ""}${round2(cur - prev)}`;
const cell = (s: string) => s.replace(/\|/g, "／").replace(/\n/g, " ");
const list = (xs: string[]) => cell(xs.join("、")) || "-";

/** 前回（無ければ null）と今回を並べた Markdown。fit を先に、機械の指標は右・下に参考として */
export function compareMarkdown(prev: Run | null, cur: Run): string {
  const fa = prev ? fitMean(prev) : null;
  const fb = fitMean(cur);
  const a = prev ? summarize(prev) : null;
  const b = summarize(cur);
  const lines = [
    `# 提案の評価 ${cur.at}`,
    "",
    `- 今回：${cur.algorithm}（採点：${cur.judgedAt ?? "未採点"}）`,
    `- 前回：${prev ? `${prev.at}（${prev.algorithm}）` : "なし"}`,
    "",
    "## グループに合った経験か（fit の平均、1〜5）",
    "",
    "| 前回 | 今回 | 差 | 判定 |",
    "| --- | --- | --- | --- |",
    `| ${fmt(fa)} | ${fb === null ? "未採点" : fb} | ${diff(fa, fb)} | ${verdict("high", fa, fb)} |`,
    "",
    "## fit が低いシナリオ",
    "",
  ];
  const low = worstByFit(cur);
  if (!low.length) lines.push("未採点（-judge.md を Agent に貼り、返事を pnpm propose:eval:judge で取り込む）");
  low.forEach((s, i) => lines.push(`${i + 1}. ${s.who}（fit ${s.judge!.fit}）${s.judge!.reason}`, `   - 足りないもの：${list(s.judge!.missing)}`));
  lines.push(
    "",
    "## シナリオごと（右の機械の指標は参考）",
    "",
    `| シナリオ | 誰が | fit | 前回との差 | 回ごと | 足りないもの | 入れるべきでなかったもの | ${METRICS.map((x) => x.label).join(" | ")} |`,
    `| --- | --- | --- | --- | --- | --- | --- | ${METRICS.map(() => "---").join(" | ")} |`,
  );
  const prevById = new Map(prev?.scenarios.map((s) => [s.id, s]) ?? []);
  for (const s of cur.scenarios) {
    const j = s.judge;
    const pj = prevById.get(s.id)?.judge;
    const m = s.result?.metrics;
    const machine = METRICS.map((x) => (m ? fmt(x.value(m)) : "-"));
    const fit = s.error ? `失敗：${cell(s.error)}` : j ? String(j.fit) : "未採点";
    lines.push(
      `| ${s.id} | ${cell(s.who)} | ${fit} | ${diff(pj?.fit, j?.fit)} | ${j ? j.rounds.join("・") : "-"} | ${j ? list(j.missing) : "-"} | ${j ? list(j.wrong) : "-"} | ${machine.join(" | ")} |`,
    );
  }
  lines.push(
    "",
    "## 参考：機械の指標の平均",
    "",
    "| 指標 | 良い向き | 前回 | 今回 | 差 | 判定 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...METRICS.map((x) => `| ${x.label} | ${x.better === "high" ? "高い" : "低い"} | ${fmt(a?.[x.key])} | ${fmt(b[x.key])} | ${diff(a?.[x.key], b[x.key])} | ${verdict(x.better, a?.[x.key], b[x.key])} |`),
    "",
  );
  return lines.join("\n");
}

const cardLine = (c: Card) =>
  `${c.name}（種類：${c.kind || "-"}／エリア：${c.area || "-"}／場所の特徴：${c.features.join("、") || "なし"}／地区の特性：${c.areaTraits.join("、") || "なし"}）`;

/** Agent（ChatGPT・Claude）に貼って採点させる指示。シナリオごとに who・want・各回の提案・プランを並べる */
export function judgePrompt(run: Run): string {
  const lines = [
    "# 旅の提案の採点",
    "",
    "あなたは旅行の編集者です。下の各シナリオは、旅の提案アプリが、あるグループ・人のために出した提案です。",
    "その人たちはアプリの画面で条件を選び、各回の提案に答えました（各回の 1 件目を「すごくいい」、残りを「うーん」）。宿 1 つと過ごし方 2 つがそろうとプランになります。",
    "見るのはただ 1 つ：**このグループ・人に、どれだけ合った経験を提案できたか**。日程（距離・移動時間）は見なくてかまいません。",
    "ここに書かれた中身（名前・種類・エリア・特徴）だけで判断し、書かれていないことは推測で補わないでください。",
    "「場所の特徴」はその場所について確かめたもの。「地区の特性」はその地区（例：温泉の多い地区）の性質で、その場所自体にあるとは限りません（例：地区の特性が温泉の滝は、滝に温泉があるわけではない）。",
    "",
    "## 返すもの（シナリオごと）",
    "",
    "- fit：このグループに合う経験か（1〜5 の整数。5 がとても合う）",
    "- reason：fit の理由（日本語 1 行）",
    "- rounds：回ごとの fit（1〜5 の整数を回の数だけ。順に 1 回目, 2 回目, …）",
    "- missing：足りないもの（例「子どもが遊べる場所が無い」「記念日らしさが無い」。無ければ空）",
    "- wrong：入れるべきでなかったもの（「場所の名前：理由」。無ければ空）",
    "",
    "## 返す形",
    "",
    "次の JSON の配列だけを返してください（前後に文章を付けない）。すべてのシナリオを入れる。",
    "",
    "```json",
    '[{"id":"<シナリオの id>","fit":3,"reason":"...","rounds":[4,3,2],"missing":["..."],"wrong":["場所の名前：理由"]}]',
    "```",
    "",
    "## シナリオ",
  ];
  for (const s of run.scenarios) {
    lines.push("", `### ${s.id}`, "", `- 誰が：${s.who}`, `- したいこと：${s.want}`);
    if (!s.result) {
      lines.push(`- （提案の取得に失敗：${s.error ?? ""}。fit 1・rounds 空で返す）`);
      continue;
    }
    const r = s.result;
    lines.push(`- 画面で選んだ条件：${r.conditions.join("、") || "なし"}${r.trip ? `（旅の目的：${r.trip}）` : ""}`);
    r.rounds.forEach((rd, i) => {
      lines.push(`- ${i + 1} 回目「${rd.lead}」`);
      for (const c of rd.cards) lines.push(`  - ${cardLine(c)}`);
    });
    lines.push(`- 最後のプラン：${r.plan.length ? r.plan.join(" → ") : "そろわなかった"}`);
  }
  lines.push("");
  return lines.join("\n");
}

const isScore = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 5;
const strings = (x: unknown): string[] | null => (Array.isArray(x) && x.every((v) => typeof v === "string") ? x : x === undefined ? [] : null);

/** Agent の返事（JSON の配列。```json の囲みや前後の文があってもよい）を読む。知らない id・形の違うものは errors に */
export function parseJudge(text: string, ids: string[]): { judges: Record<string, Judge>; errors: string[] } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  let arr: unknown;
  try {
    arr = JSON.parse(body);
  } catch {
    return { judges: {}, errors: ["JSON として読めない"] };
  }
  if (!Array.isArray(arr)) return { judges: {}, errors: ["JSON の配列ではない"] };
  const known = new Set(ids);
  const judges: Record<string, Judge> = {};
  const errors: string[] = [];
  for (const x of arr as Record<string, unknown>[]) {
    const id = typeof x?.id === "string" ? x.id : "";
    if (!known.has(id)) {
      errors.push(`知らない id：${id || "(なし)"}`);
      continue;
    }
    const rounds = Array.isArray(x.rounds) ? x.rounds : [];
    const missing = strings(x.missing);
    const wrong = strings(x.wrong);
    if (!isScore(x.fit) || !rounds.every(isScore) || !missing || !wrong) {
      errors.push(`形が違う：${id}`);
      continue;
    }
    judges[id] = { fit: x.fit, reason: typeof x.reason === "string" ? x.reason : "", rounds, missing, wrong };
  }
  for (const id of ids) if (!judges[id] && !errors.some((e) => e.endsWith(`：${id}`))) errors.push(`採点が無い：${id}`);
  return { judges, errors };
}

/** 採点を結果に付ける（元の run は変えない） */
export function attachJudges(run: Run, judges: Record<string, Judge>, at: string): Run {
  return { ...run, judgedAt: at, scenarios: run.scenarios.map((s) => (judges[s.id] ? { ...s, judge: judges[s.id] } : s)) };
}
