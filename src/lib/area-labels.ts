// 地図のラベルを、重ならない・枠からはみ出さないものだけ置く（純関数）
export type LabelCandidate = { id: string; text: string; at: [number, number]; size: [number, number]; font: number; rank: number };
// at = ラベル中心の px、size = エリアの画面上の幅・高さ px、font = 文字の px、rank = 大きいほど先に置く
export type LabelFrame = { width: number; height: number; top: number; bottom: number; selected: string | null };

/** 置けるラベルを置いた順に返す（選択中が最優先、あとは rank の大きい順） */
export function layoutLabels(cands: LabelCandidate[], frame: LabelFrame): { id: string; x: number; y: number }[] {
  const order = [...cands].sort((a, b) => Number(b.id === frame.selected) - Number(a.id === frame.selected) || b.rank - a.rank);
  const placed: { l: number; r: number; t: number; b: number }[] = [];
  const out: { id: string; x: number; y: number }[] = [];
  for (const c of order) {
    const bw = c.text.length * c.font + 4;
    const bh = c.font + 4;
    if (c.id !== frame.selected && c.size[0] < bw * 0.6 && c.size[1] < 24) continue;
    const l = c.at[0] - bw / 2;
    const r = c.at[0] + bw / 2;
    const t = c.at[1] - bh / 2;
    const b = c.at[1] + bh / 2;
    if (l < 4 || r > frame.width - 4 || t < frame.top || b > frame.height - frame.bottom) continue;
    if (placed.some((p) => l < p.r + 4 && r > p.l - 4 && t < p.b + 2 && b > p.t - 2)) continue;
    placed.push({ l, r, t, b });
    out.push({ id: c.id, x: c.at[0], y: c.at[1] });
  }
  return out;
}
