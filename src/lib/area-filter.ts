// 選んだ特性に合うエリアを絞る（純関数）
export type TraitView = { id: string; label: string; icon: string };
/** 特性の一覧と、エリアごとの特性 id（そのエリアに直接付いたもの） */
export type AreaTraits = { traits: TraitView[]; byRegion: Record<string, string[]> };

/** 選んだ特性に合うエリアの id（親も含む）。何も選んでいなければ null（全部 ON） */
export function filterAreas(byRegion: Record<string, string[]>, picked: string[], parentOf: Record<string, string | null>): Set<string> | null {
  if (picked.length === 0) return null;
  const out = new Set<string>();
  for (const [id, ts] of Object.entries(byRegion)) {
    if (!picked.every((p) => ts.includes(p))) continue;
    out.add(id);
    for (let p = parentOf[id]; p && !out.has(p); p = parentOf[p]) out.add(p);
  }
  return out;
}
