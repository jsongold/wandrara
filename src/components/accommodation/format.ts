// 宿の詳細の部品で使う、短い文の組み立て
import type { LabeledText, RoomView } from "@/lib/accommodation/view";
// vitest は @ を解決しないので相対パスで読む
import { messages } from "../../lib/i18n/messages";
import type { Locale } from "@/lib/types";

/** 「45,000」 */
export const yen = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** 「A」「AとB」「A・BとC」。同じラベルは 1 つにする。en は「A, B, C」 */
export function joinLabels(labels: string[], locale: Locale = "ja"): string {
  const t = messages(locale).accommodation;
  const u = [...new Set(labels)];
  if (u.length <= 1) return u[0] ?? "";
  return `${u.slice(0, -1).join(t.sep)}${t.andSep}${u[u.length - 1]}`;
}

/** 料金の表の下の注記。別にかかる料金があれば足す（宿泊料に込みのものは足さない） */
export function priceNote(fees: LabeledText[], locale: Locale = "ja"): string {
  const t = messages(locale).accommodation.price;
  const extra = fees.filter((f) => !f.includedInRoom);
  return extra.length ? `${t.varies}${t.extra(joinLabels(extra.map((f) => f.label), locale))}` : t.varies;
}

/** 部屋の行の値。定員だけなら「12 名まで」、ほかもあれば「2 名・24㎡・シングル 2」 */
export function roomSummary(r: RoomView, locale: Locale = "ja"): string {
  const t = messages(locale).accommodation;
  const rest = [
    r.areaSqm !== null ? t.room.sqm(r.areaSqm) : null,
    r.tatami !== null ? t.room.tatami(r.tatami) : null,
    r.styleLabel,
    r.bedrooms.length === 1 ? r.bedrooms[0].beds : r.bedrooms.length > 1 ? t.room.bedrooms(r.bedrooms.length) : null,
  ].filter((x): x is string => !!x);
  if (r.capacity === null) return rest.join(t.sep);
  if (!rest.length) return t.room.upTo(r.capacity);
  return [t.room.guests(r.capacity), ...rest].join(t.sep);
}
