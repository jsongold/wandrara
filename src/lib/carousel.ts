// カードの下のカルーセルに何をどの順で並べるか（carousel の段）。関連タイルの選び方（secondary）とは別に差し替えられる。
// 戦略は名前と版の表から選ぶ（feed-config と同じ）。中身を変えたら version を上げる。表示ログで前後を比べるため
import { areaHighlights } from "./area-highlights";
import type { CarouselItem, Locale, Tile } from "./types";

export type CarouselCtx = { area: string; locale: Locale };
// tilesPerCard：重複を省いた後の関連タイル（カードごと）
export type CarouselStrategy = (tilesPerCard: Tile[][], ctx: CarouselCtx) => CarouselItem[][];

// エリアの一言の 1 枚。データが無いエリア（全国を含む）は null
// v1 は絞り込んだエリア（query.area）で決める。カードの地区で決めるには feed_page が地区の id を返す必要がある
export function storiesItemOf(area: string, locale: Locale): CarouselItem | null {
  return areaHighlights(area, locale).length > 0 ? { type: "stories", area } : null;
}

const dests = (tiles: Tile[]): CarouselItem[] => tiles.map((tile) => ({ type: "dest", tile }));

// 行き先のタイルだけ（Stories を出さない）
export const destOnly: CarouselStrategy = (tilesPerCard) => tilesPerCard.map(dests);

// Stories を先頭に置く。行き先のタイルが無いカードにも出す
export const storiesFirst: CarouselStrategy = (tilesPerCard, ctx) => {
  const s = storiesItemOf(ctx.area, ctx.locale);
  return tilesPerCard.map((tiles) => (s ? [s, ...dests(tiles)] : dests(tiles)));
};

// Stories を末尾に置く
export const storiesLast: CarouselStrategy = (tilesPerCard, ctx) => {
  const s = storiesItemOf(ctx.area, ctx.locale);
  return tilesPerCard.map((tiles) => (s ? [...dests(tiles), s] : dests(tiles)));
};

type Entry = { version: number; run: CarouselStrategy };

const CAROUSEL: Record<string, Entry> = {
  "dest-only": { version: 1, run: destOnly },
  "stories-first": { version: 1, run: storiesFirst },
  "stories-last": { version: 1, run: storiesLast },
};

const DEFAULT = "stories-first";

// id は表示ログの algorithm に足す（例：carousel=stories-first@1）
export type CarouselEntry = { id: string; run: CarouselStrategy };

// 知らない名前・未設定は既定にする
export function loadCarouselStrategy(name: string | undefined = process.env.CAROUSEL_STRATEGY): CarouselEntry {
  const key = name && Object.hasOwn(CAROUSEL, name) ? name : DEFAULT;
  return { id: `carousel=${key}@${CAROUSEL[key].version}`, run: CAROUSEL[key].run };
}

// カルーセルの中の行き先のタイル（重複の間引き・cursor に使う）
export function destTilesOf(items: CarouselItem[]): Tile[] {
  return items.flatMap((x) => (x.type === "dest" ? [x.tile] : []));
}
