// dest ごとの特徴（dest_traits）の読み元。今はまだ本番の DB に表が無いので、ローカルで判定した結果
// （data/dest-traits/judged.json。git に入れない）があれば読む。無ければ空。DB に入ったらここだけ差し替える
import fs from "node:fs/promises";
import path from "node:path";

type Judged = { dests: { destId: string; accepted: { traitId: string }[] }[] };

/** dest_id → 特徴 id の一覧 */
export async function getDestTraits(): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data/dest-traits/judged.json"), "utf8");
    return destTraitsOf(JSON.parse(raw) as Judged);
  } catch {
    return {};
  }
}

/** 判定結果を dest_id → 特徴 id にする（純関数） */
export function destTraitsOf(j: Judged): Record<string, string[]> {
  return Object.fromEntries(j.dests.filter((d) => d.accepted.length).map((d) => [d.destId, d.accepted.map((a) => a.traitId)]));
}
