// Google マップで店を開く（Maps URLs。API キーは要らない）。MS1（#114）で place_id を持てば query_place_id も付ける
import type { HighlightOffer } from "@/lib/area-highlights";

export function mapsUrl(o: Pick<HighlightOffer, "shopName" | "fullAddress">): string {
  // 検索には省く前の住所を使う（町名だけだと別の町の同じ名前の店に当たる）
  const q = [o.shopName, o.fullAddress].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
