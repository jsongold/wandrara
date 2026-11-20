// 提案の評価を全シナリオ（グループ・人）で回す。開発サーバー（next dev）の /api/propose-eval を呼ぶ。
//   pnpm propose:eval                 http://localhost:3000（pnpm dev）に対して回す。別のポートは PROPOSE_EVAL_BASE=http://localhost:3300
// 出力（data/propose-eval/）：<日時>.json・<日時>.md（前回との比較。fit は未採点）・<日時>-judge.md（Agent に貼る採点の指示）
// 採点：-judge.md を ChatGPT・Claude に貼り、返事をコピーして pnpm propose:eval:judge（クリップボードかファイル）
import fs from "node:fs";
import path from "node:path";
import { judgePrompt, type Run, type ScenarioResult } from "./report.ts";
import { OUT, save, stampOf } from "./store.ts";

const BASE = process.env.PROPOSE_EVAL_BASE ?? "http://localhost:3000";

type Scenario = { id: string; who: string; want: string; query: Record<string, string> };

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function main() {
  const scenarios = (await getJson(`${BASE}/api/propose-eval/scenarios`)) as Scenario[];
  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    const url = `${BASE}/api/propose-eval?${new URLSearchParams({ lang: "ja", ...s.query })}`;
    try {
      results.push({ ...s, result: (await getJson(url)) as ScenarioResult["result"] });
      console.log(`ok   ${s.id}`);
    } catch (e) {
      results.push({ ...s, error: (e as Error).message });
      console.log(`fail ${s.id} ${(e as Error).message}`);
    }
  }
  const now = new Date();
  const stamp = stampOf(now);
  const algorithms = [...new Set(results.flatMap((r) => (r.result ? [r.result.algorithm] : [])))];
  const run: Run = { at: now.toISOString(), base: BASE, algorithm: algorithms.join(" / "), scenarios: results };
  const md = save(stamp, run);
  const judge = path.join(OUT, `${stamp}-judge.md`);
  fs.writeFileSync(judge, judgePrompt(run));
  console.log(`\n${md}`);
  console.log(`saved ${OUT}/${stamp}.json / .md`);
  console.log(`採点：${judge} を Agent に貼り、返事をコピーして pnpm propose:eval:judge`);
  if (results.some((r) => r.error)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
