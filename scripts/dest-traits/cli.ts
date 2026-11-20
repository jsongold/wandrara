// dest の特徴（dest_traits）を、紹介文から判定して作る。結果はローカルだけに置く（本番 DB には書かない）。
// 使い方（pnpm dest-traits <コマンド>）。ANTHROPIC_API_KEY が要る（extract・verify）
//   extract [--from local|env] [--limit N]  dest の紹介文を Haiku で判定 → data/dest-traits/judged.json
//                                            --from local（既定）：ローカルの Supabase を読む。env：.env.local の NEXT_PUBLIC_SUPABASE_URL を読む（読むだけ）
//   verify [--n 50]                          judged.json から N 組を選び、Sonnet で判定し直して一致率を出す → data/dest-traits/verify.json
//   load                                     judged.json の値をローカルの Supabase の dest_traits に入れる（ローカル以外の URL には書かない）
// data/ は git に入れない
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../../src/lib/supabase/admin.ts";
import { selectAll } from "../../src/lib/supabase/select-all.ts";
import { complete, HAIKU, SONNET } from "./anthropic.ts";
import {
  agreement, buildPrompt, parseResponse, pickVerifySample, PICKED_TRAIT_IDS, traitsFor,
  type Compared, type DestText, type Judgement, type Reject,
} from "./judge.ts";
import { parseTraitTsv, type TraitDef } from "./trait-defs.ts";

const OUT = path.resolve("data/dest-traits");
const JUDGED = path.join(OUT, "judged.json");
const VERIFY = path.join(OUT, "verify.json");
const VERSION = "text-haiku-5-5-v1"; // dest_traits.version（作り方の版）。プロンプトや判定のモデルを変えたら上げる

type JudgedDest = DestText & { asked: string[]; accepted: Judgement[]; rejected: Reject[]; error?: string };
type Judged = { version: string; model: string; createdAt: string; source: string; dests: JudgedDest[] };

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function pickedDefs(): TraitDef[] {
  const all = parseTraitTsv(fs.readFileSync(new URL("../../docs/suggest/trait-candidates.tsv", import.meta.url), "utf8"));
  const byId = new Map(all.map((d) => [d.id, d]));
  return PICKED_TRAIT_IDS.map((id) => {
    const d = byId.get(id);
    if (!d || d.source !== "text" || d.valueType !== "flag") throw new Error(`選んだ特徴が定義表に無い・紹介文の flag でない: ${id}`);
    return d;
  });
}

/** ローカルの Supabase のクライアント。環境変数 LOCAL_SUPABASE_URL・LOCAL_SUPABASE_SECRET_KEY か、`supabase status` の値。ローカル以外の URL は使わない */
function localClient(): SupabaseClient {
  let url = process.env.LOCAL_SUPABASE_URL;
  let key = process.env.LOCAL_SUPABASE_SECRET_KEY;
  if (!url || !key) {
    const out = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const get = (k: string) => new RegExp(`^${k}="?([^"\\n]*)"?$`, "m").exec(out)?.[1];
    url ??= get("API_URL");
    key ??= get("SECRET_KEY");
  }
  if (!url || !key) throw new Error("ローカルの Supabase の URL・キーが分からない（supabase start か LOCAL_SUPABASE_URL・LOCAL_SUPABASE_SECRET_KEY）");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`ローカルの URL ではない: ${url}`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type CardRow = { dest_id: string; core_type: string; name: Record<string, string> | null; summary: Record<string, string> | null };

async function readDests(db: SupabaseClient, limit: number | undefined): Promise<DestText[]> {
  const rows = await selectAll<CardRow>(db, "dest_cards", "dest_id, core_type, name, summary", ["dest_id"]);
  const dests = rows
    .filter((r) => r.name?.ja && r.summary?.ja) // 紹介文（ja）が無い dest は判定しない
    .map((r) => ({ destId: r.dest_id, coreType: r.core_type, name: r.name!.ja, summary: r.summary!.ja }));
  return limit ? dests.slice(0, limit) : dests;
}

/** 同時に n 件まで */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function extract() {
  const from = flag("from") ?? "local";
  if (from !== "local" && from !== "env") throw new Error("--from は local か env");
  const db = from === "local" ? localClient() : adminClient();
  const limit = flag("limit") ? Number(flag("limit")) : undefined;
  const defs = pickedDefs();
  const dests = await readDests(db, limit);
  console.log(`dest ${dests.length} 件（読み元 ${from}）を ${HAIKU} で判定する。特徴 ${defs.length} 件`);

  const judged = await pool(dests, 4, async (d): Promise<JudgedDest> => {
    const asked = traitsFor(d, defs);
    if (asked.length === 0) return { ...d, asked: [], accepted: [], rejected: [] };
    try {
      const p = buildPrompt(d, asked);
      const { accepted, rejected } = parseResponse(await complete(HAIKU, p.system, p.user), d, asked);
      return { ...d, asked: asked.map((t) => t.id), accepted, rejected };
    } catch (e) {
      return { ...d, asked: asked.map((t) => t.id), accepted: [], rejected: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  const failed = judged.filter((d) => d.error);
  if (failed.length > 0 && failed.length === judged.filter((d) => d.asked.length > 0).length) {
    throw new Error(`判定が全部失敗した（書かない）: ${failed[0].error}`); // キーが無い・モデル名が違う、など
  }
  const out: Judged = { version: VERSION, model: HAIKU, createdAt: new Date().toISOString(), source: from, dests: judged };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(JUDGED, JSON.stringify(out, null, 2));
  const errors = judged.filter((d) => d.error);
  const accepted = judged.reduce((s, d) => s + d.accepted.length, 0);
  console.log(`判定した dest ${judged.length - errors.length} 件（失敗 ${errors.length}）、値が付いた ${accepted} 件、除いた ${judged.reduce((s, d) => s + d.rejected.length, 0)} 件 → ${JUDGED}`);
  if (errors[0]) console.log(`失敗の例: ${errors[0].error}`);
}

function readJudged(): Judged {
  if (!fs.existsSync(JUDGED)) throw new Error(`${JUDGED} が無い。先に extract`);
  return JSON.parse(fs.readFileSync(JUDGED, "utf8")) as Judged;
}

async function verify() {
  const n = Number(flag("n") ?? 50);
  const judged = readJudged();
  const defs = new Map(pickedDefs().map((d) => [d.id, d]));
  const pairs = judged.dests
    .filter((d) => !d.error)
    .flatMap((d) => d.asked.map((traitId) => ({ destId: d.destId, traitId, a: d.accepted.some((j) => j.traitId === traitId) })));
  const chosen = pickVerifySample(pairs, n);
  const byDest = new Map<string, string[]>();
  for (const p of chosen) byDest.set(p.destId, [...(byDest.get(p.destId) ?? []), p.traitId]);
  console.log(`${pairs.length} 組から ${chosen.length} 組（付いた ${chosen.filter((p) => p.a).length}）を ${SONNET} で判定し直す`);

  const sonnet = new Map<string, Set<string>>();
  await pool([...byDest], 4, async ([destId, traitIds]) => {
    const dest = judged.dests.find((d) => d.destId === destId)!;
    const traits = traitIds.map((id) => defs.get(id)!);
    const p = buildPrompt(dest, traits);
    const { accepted } = parseResponse(await complete(SONNET, p.system, p.user), dest, traits);
    sonnet.set(destId, new Set(accepted.map((j) => j.traitId)));
  });

  const compared: Compared[] = chosen.map((p) => ({ ...p, b: sonnet.get(p.destId)?.has(p.traitId) ?? false }));
  const r = agreement(compared);
  fs.writeFileSync(VERIFY, JSON.stringify({ haiku: judged.model, sonnet: SONNET, ...r, pairs: compared }, null, 2));
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log(`一致率 ${r.rate === null ? "-" : pct(r.rate)}（${r.agree}/${r.total}）。Haiku が付けた ${r.aTrue.total} 組のうち Sonnet も付けた ${r.aTrue.agree} 組 → ${VERIFY}`);
}

async function load() {
  const judged = readJudged();
  const db = localClient();
  const ids = judged.dests.map((d) => d.destId);
  const { data, error } = await db.from("destinations").select("dest_id").in("dest_id", ids);
  if (error) throw new Error(`destinations: ${error.message}`);
  const present = new Set((data ?? []).map((r: { dest_id: string }) => r.dest_id));
  const rows = judged.dests
    .filter((d) => present.has(d.destId))
    .flatMap((d) =>
      d.accepted.map((j) => ({ dest_id: d.destId, trait_id: j.traitId, value: 1, evidence: j.evidence, confidence: j.confidence, version: judged.version, updated_at: new Date().toISOString() })),
    );
  const skipped = judged.dests.filter((d) => !present.has(d.destId)).length;
  if (rows.length > 0) {
    const r = await db.from("dest_traits").upsert(rows, { onConflict: "dest_id,trait_id" });
    if (r.error) throw new Error(`dest_traits: ${r.error.message}`);
  }
  console.log(`ローカルの dest_traits に ${rows.length} 行を入れた（ローカルに無い dest ${skipped} 件は飛ばした）`);
}

try {
  const cmd = process.argv[2];
  if (cmd === "extract") await extract();
  else if (cmd === "verify") await verify();
  else if (cmd === "load") await load();
  else throw new Error("使い方: pnpm dest-traits extract|verify|load");
} catch (e) {
  console.error(`error: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
}
