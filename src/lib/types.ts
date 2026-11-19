// 画面の共通型。DB の行（*Row）と、画面に渡す形（*View / Feed*）を分ける。
import type { Mode } from "./modes";

export type { Mode };
export type Locale = "ja" | "en";
import type { LocalizedText } from "./i18n/localized";
export type { LocalizedText };
export type SortKey = "editorial" | "fresh";
export type FactStatus = "verified" | "unverified" | "unknown";

export type Region = { id: string; parentId: string | null; name: LocalizedText; sort: number };
export type Category = { id: string; parentId: string | null; name: LocalizedText; icon: string; sort: number };

export type Photo = {
  url: string | null;
  license: string | null;
  credit: string | null;
  isDemo: boolean;
  placeholderSky: string | null;
  placeholderLand: string | null;
};

// dest_cards ビューの 1 行（公開中の dest）
export type DestCard = {
  id: string;
  coreType: string;
  slug: string;
  regionId: string | null;
  name: LocalizedText;
  summary: LocalizedText | null;
  isDemo: boolean;
  createdAt: string;
  publishedAt: string | null;
  categoryIds: string[];
  photos: Photo[];
};

// 探索条件（URL と 1 対 1）。area / cat は "all" で未指定
export type DiscoverQuery = { mode: Mode; area: string; cat: string; sort: SortKey; q: string };

// ---- 画面に渡す形 ----

export type CategoryView = { id: string; label: string; icon: string };
export type AreaGroupView = { id: string; label: string; subs: { id: string; label: string }[] };

export type Tile = { destId: string; label: string; sub: string; photo: Photo | null; href: string };

// カードの下のカルーセルの 1 枚（何をどの順で出すかは carousel の戦略が決める。src/lib/carousel.ts）
// 行き先のタイルか、エリアの一言（Area Stories）をまとめた 1 枚。stories は開くエリア（地区の id）とその名前だけを持ち、中身は画面が areaHighlights で読む
export type CarouselItem = { type: "dest"; tile: Tile } | { type: "stories"; area: string; label: string };

export type FeedCard = {
  key: string;
  destId: string;      // そのカードの dest の dest_id（保存の対象。catalog の DestCard.id）
  title: string;
  areaLabel: string;   // 例：「箱根・芦ノ湖」
  kindLabel: string;   // 例：「宿」「温泉地」（コアのラベル）
  relLabel: string;    // 例：「この近く」
  photos: Photo[]; // 先頭がカードの最初の写真。横にスワイプして切り替える
  href: string;        // 詳細へのリンク
  carousel: CarouselItem[];
};

export type FeedPage = {
  cards: FeedCard[];
  orderLabel: string;              // 例：「編集部のおすすめ順」
  algorithm: string;               // 使った戦略の名前と版。例：「order=editorial@1 primary=by-mode@2 secondary=related-any-kind@1 carousel=stories-first-once@1」
  emptyReason: "no-match" | null;  // 0 件のときの理由
};

export type FactView = {
  key: string;
  label: string;
  value: string | null;            // null は「情報なし」
  status: FactStatus;
  sourceName: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  detail: string | null;
};
