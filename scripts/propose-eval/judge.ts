// Agent の採点の返事を取り込み、結果に付けて前回と比べ直す。
//   pnpm propose:eval:judge                   クリップボード（pbpaste）の返事を、一番新しい結果に付ける
//   pnpm propose:eval:judge answers.json      ファイルの返事を付ける
//   pnpm propose:eval:judge --run 20261120-093947 [file]   結果を選ぶ
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { attachJudges, parseJudge } from "./report.ts";
import { OUT, readRun, save, stamps } from "./store.ts";

const args = process.argv.slice(2);
const runAt = args.indexOf("--run");
const stamp = runAt >= 0 ? args[runAt + 1] : stamps().at(-1);
const file = runAt >= 0 ? args.filter((_, i) => i !== runAt && i !== runAt + 1)[0] : args[0];
if (!stamp) throw new Error(`${OUT} に結果が無い。先に pnpm propose:eval`);

const text = file ? fs.readFileSync(file, "utf8") : execFileSync("pbpaste", { encoding: "utf8" });
const run = readRun(stamp);
const { judges, errors } = parseJudge(text, run.scenarios.map((s) => s.id));
for (const e of errors) console.log(`warn ${e}`);
if (!Object.keys(judges).length) {
  console.error("取り込める採点が無い");
  process.exit(1);
}
const md = save(stamp, attachJudges(run, judges, new Date().toISOString()));
console.log(`\n${md}`);
console.log(`saved ${OUT}/${stamp}.json / .md（採点 ${Object.keys(judges).length}/${run.scenarios.length}）`);
