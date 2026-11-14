// v0 の共通型。DB の行（*Row）と、画面に渡す形（*View / Feed*）を分ける。

export type Locale = "ja" | "en";
export type LocalizedText = Partial<Record<Locale, string>>;
export type Mode = "place" | "experience";
export type SpotKind = "stay" | "place" | "experience";
export type SortKey = "editorial" | "fresh";
export type FactStatus = "verified" | "unverified" | "unknown";

export type Area = { id: string; parentId: string | null; name: LocalizedText; sort: number };
export type Category = { id: string; mode: Mode; parentId: string | null; name: LocalizedText; icon: string; sort: number };

export type Photo = {
  url: string | null;
  license: string | null;
  credit: string | null;
  isDemo: boolean;
  placeholderSky: string | null;
  placeholderLand: string | null;
};

export type Spot = {
  id: string;
  kind: SpotKind;
  areaId: string | null;
  name: LocalizedText;
  summary: LocalizedText | null;
  editorialRank: number;
  isDemo: boolean;
  createdAt: string;
  categoryIds: string[];
  photos: Photo[];
};

export type Fact = {
  key: string;
  label: LocalizedText;
  value: LocalizedText | null;
  status: FactStatus;
  sourceName: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  detail: LocalizedText | null;
  sort: number;
};

// 探索条件（URL と 1 対 1）。area / cat は "all" で未指定
export type DiscoverQuery = { mode: Mode; area: string; cat: string; sort: SortKey; q: string };

// ---- 画面に渡す形 ----

export type CategoryView = { id: string; label: string; icon: string };
export type AreaGroupView = { id: string; label: string; subs: { id: string; label: string }[] };

export type Tile = { spotId: string; label: string; sub: string; photo: Photo | null; href: string };

export type FeedCard = {
  key: string;
  title: string;
  areaLabel: string;   // 例：「箱根・芦ノ湖」、体験カードは「3か所で体験できる」
  kindLabel: string;   // 例：「宿」「体験」
  relLabel: string;    // 例：「関連する体験」「体験できる場所」
  photos: Photo[]; // 先頭がカードの最初の写真。横にスワイプして切り替える
  href: string;        // 詳細へのリンク（体験カードは先頭の場所）
  tiles: Tile[];
};

export type FeedPage = {
  cards: FeedCard[];
  orderLabel: string;              // 例：「編集部のおすすめ順」
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

export type SpotDetailView = {
  id: string;
  title: string;
  areaLabel: string;
  kindLabel: string;
  summary: string | null;
  isDemo: boolean;
  photos: Photo[];
  facts: FactView[];
};
