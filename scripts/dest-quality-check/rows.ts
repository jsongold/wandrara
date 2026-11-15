// dest ごとに中身の決まりを当て、dest_quality_check の行にする（純関数）。
// 当てる中身は最新の投入（dest_imports.payload）。dest_apply が表を投入の中身で全部入れ直すので、最新の投入が今の表の中身と同じ
import type { DestInput } from "../../src/lib/ingest/bundle.ts";
import { evaluateQuality, QUALITY_VERSION, type QualityIssue } from "../../src/lib/ingest/quality.ts";

export type QualityRow = { dest_id: string; quality: number; reason: { version: string; issues: QualityIssue[] } };

export const NO_IMPORT: QualityIssue = { path: "/", message: "投入の記録が無い（中身を確かめられない）" };

export function buildQualityRows(dests: { dest_id: string; core_type: string }[], latest: Map<string, unknown>): QualityRow[] {
  return dests.map((d) => {
    const payload = latest.get(d.dest_id);
    if (!payload) return { dest_id: d.dest_id, quality: 0, reason: { version: QUALITY_VERSION, issues: [NO_IMPORT] } };
    const { score, issues } = evaluateQuality(d.core_type, payload as DestInput);
    return { dest_id: d.dest_id, quality: score, reason: { version: QUALITY_VERSION, issues } };
  });
}

/** 新しい順に並んだ投入から、dest ごとの最新の payload を取る */
export function latestPayloads(importsNewestFirst: { dest_id: string | null; payload: unknown }[]): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const i of importsNewestFirst) if (i.dest_id && !out.has(i.dest_id)) out.set(i.dest_id, i.payload);
  return out;
}

/** 種類ごとの件数・全部満たす件数・quality の平均（表示用） */
export function summarize(dests: { dest_id: string; core_type: string }[], rows: QualityRow[]): string[] {
  const byId = new Map(rows.map((r) => [r.dest_id, r]));
  const per = new Map<string, QualityRow[]>();
  for (const d of dests) per.set(d.core_type, [...(per.get(d.core_type) ?? []), byId.get(d.dest_id)!]);
  return [...per].map(([t, rs]) => {
    const full = rs.filter((r) => r.quality === 100).length;
    const avg = Math.round(rs.reduce((s, r) => s + r.quality, 0) / rs.length);
    return `${t}: ${rs.length} 件・全部満たす ${full} 件・quality 平均 ${avg}`;
  });
}
