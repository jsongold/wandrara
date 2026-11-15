// 宿の詳細の部品で使う、短い文の組み立て
import type { LabeledText, RoomView } from "@/lib/accommodation/view";

/** 「45,000」 */
export const yen = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** 「A」「AとB」「A・BとC」。同じラベルは 1 つにする */
export function joinLabels(labels: string[]): string {
  const u = [...new Set(labels)];
  if (u.length <= 1) return u[0] ?? "";
  return `${u.slice(0, -1).join("・")}と${u[u.length - 1]}`;
}

/** 料金の表の下の注記。別にかかる料金があれば足す */
export function priceNote(fees: LabeledText[]): string {
  const base = "人数と日によって変わります。";
  return fees.length ? `${base}別途、${joinLabels(fees.map((f) => f.label))}がかかります。` : base;
}

/** 部屋の行の値。定員だけなら「12 名まで」、ほかもあれば「2 名・24㎡・シングル 2」 */
export function roomSummary(r: RoomView): string {
  const rest = [
    r.areaSqm !== null ? `${r.areaSqm}㎡` : null,
    r.tatami !== null ? `${r.tatami} 畳` : null,
    r.styleLabel,
    r.bedrooms.length === 1 ? r.bedrooms[0].beds : r.bedrooms.length > 1 ? `寝室 ${r.bedrooms.length} 室` : null,
  ].filter((x): x is string => !!x);
  if (r.capacity === null) return rest.join("・");
  if (!rest.length) return `${r.capacity} 名まで`;
  return [`${r.capacity} 名`, ...rest].join("・");
}
