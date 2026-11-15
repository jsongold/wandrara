// 検証の結果を dest ごとにまとめる。errors は parseBundle の「/dests/<i>/... 理由」と、写真の読み込みの失敗

export type DestReport = { index: number; label: string; core_type: string; errors: string[] };

type RawDest = { ref?: unknown; slug?: unknown; core_type?: unknown };

/** bundle 全体に関わるエラー（/dests/<i> で始まらないもの）は bundle にまとめ、残りを dest ごとに分ける */
export function groupByDest(errors: string[], rawDests: unknown[]): { bundle: string[]; dests: DestReport[] } {
  const dests: DestReport[] = rawDests.map((d, index) => {
    const r = (d ?? {}) as RawDest;
    const label = typeof r.ref === "string" && r.ref ? r.ref : typeof r.slug === "string" && r.slug ? r.slug : `(dests[${index}])`;
    return { index, label, core_type: typeof r.core_type === "string" ? r.core_type : "?", errors: [] };
  });
  const bundle: string[] = [];
  for (const e of errors) {
    const m = /^\/dests\/(\d+)(\/\S*)?\s+(.*)$/.exec(e);
    const target = m ? dests[Number(m[1])] : undefined;
    if (target) target.errors.push(`${m![2] || "/"} ${m![3]}`);
    else bundle.push(e);
  }
  return { bundle, dests };
}

/** 人が読む形。OK の dest は 1 行、NG の dest は理由を字下げで並べ、最後に件数 */
export function formatReport(r: { bundle: string[]; dests: DestReport[] }): string {
  const lines: string[] = [];
  for (const e of r.bundle) lines.push(`NG  bundle: ${e}`);
  for (const d of r.dests) {
    if (!d.errors.length) lines.push(`OK  ${d.label} (${d.core_type})`);
    else {
      lines.push(`NG  ${d.label} (${d.core_type})`);
      for (const e of d.errors) lines.push(`      ${e}`);
    }
  }
  const ok = r.dests.filter((d) => !d.errors.length).length;
  lines.push(`${r.dests.length} 件中 ${ok} 件 OK${r.bundle.length ? `（bundle 全体のエラー ${r.bundle.length} 件）` : ""}`);
  return lines.join("\n");
}
