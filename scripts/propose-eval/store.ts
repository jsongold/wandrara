// 提案の評価の結果の置き場（data/propose-eval/。git に入れない）：<日時>.json（結果・採点）・<日時>.md（前回との比較）・<日時>-judge.md（採点の指示）
import fs from "node:fs";
import path from "node:path";
import { compareMarkdown, type Run } from "./report.ts";

export const OUT = path.join("data", "propose-eval");
const RUN_FILE = /^(\d{8}-\d{6})\.json$/;

export const stampOf = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/** 保存した結果の日時（古い順） */
export function stamps(): string[] {
  if (!fs.existsSync(OUT)) return [];
  return fs.readdirSync(OUT).flatMap((f) => f.match(RUN_FILE)?.[1] ?? []).sort();
}

export const readRun = (stamp: string): Run => JSON.parse(fs.readFileSync(path.join(OUT, `${stamp}.json`), "utf8")) as Run;

/** 比べる前回：stamp より前で採点のある一番新しいもの。無ければ stamp より前の一番新しいもの */
export function previous(stamp: string): Run | null {
  const before = stamps().filter((s) => s < stamp).map(readRun);
  return before.filter((r) => r.judgedAt).at(-1) ?? before.at(-1) ?? null;
}

/** 結果と前回との比較を書き、比較の Markdown を返す */
export function save(stamp: string, run: Run): string {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${stamp}.json`), JSON.stringify(run, null, 2));
  const md = compareMarkdown(previous(stamp), run);
  fs.writeFileSync(path.join(OUT, `${stamp}.md`), md);
  return md;
}
