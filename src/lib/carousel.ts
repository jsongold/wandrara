// カードの下のカルーセルに何をどの順で並べるか（carousel の段）。関連タイルの選び方（secondary）とは別に差し替えられる。
// 戦略は名前と版の表から選ぶ（feed-config と同じ）。中身を変えたら version を上げる。表示ログで前後を比べるため。
// 並び（order）が決まった後のページ全体を受け取るので、フィードのアルゴリズムが変わっても同じ戦略を使える
import { areaHighlights } from "./area-highlights";
import type { CarouselItem, Locale, Tile } from "./types";

// カードの地区（自分、親の順）。エリアの一言は地区の id で引く
export type CarouselRegion = { id: string; name: string };
// 1 枚のカードの材料：重複を省いた後の関連タイルと、カードの地区
export type CarouselRow = { tiles: Tile[]; regions: CarouselRegion[] };

// prevArea：このページの前のカード（ページ送りで前のページの最後のカード）のエリアの一言のエリア。無ければ null
export type CarouselCtx = { locale: Locale; prevArea: string | null };
export type CarouselStrategy = (rows: CarouselRow[], ctx: CarouselCtx) => CarouselItem[][];

// カードの地区のエリアの一言。地区に無ければ親で引く。どちらにも無ければ null
export function storiesAreaOf(regions: CarouselRegion[], locale: Locale): CarouselRegion | null {
  return regions.find((x) => areaHighlights(x.id, locale).length > 0) ?? null;
}

const dests = (tiles: Tile[]): CarouselItem[] => tiles.map((tile) => ({ type: "dest", tile }));
const storiesOf = (r: CarouselRegion): CarouselItem => ({ type: "stories", area: r.id, label: r.name });

// Stories を置く場所と、置くかどうか（前のカードと同じエリアか）で戦略を組む
function withStories(place: "first" | "last", once: boolean): CarouselStrategy {
  return (rows, ctx) => {
    let prev = ctx.prevArea;
    return rows.map((r) => {
      const s = storiesAreaOf(r.regions, ctx.locale);
      const show = s !== null && !(once && s.id === prev);
      prev = s?.id ?? null;
      if (!show) return dests(r.tiles);
      return place === "first" ? [storiesOf(s), ...dests(r.tiles)] : [...dests(r.tiles), storiesOf(s)];
    });
  };
}

// 行き先のタイルだけ（Stories を出さない）
export const destOnly: CarouselStrategy = (rows) => rows.map((r) => dests(r.tiles));
// Stories を先頭に置く。行き先のタイルが無いカードにも出す
export const storiesFirst = withStories("first", false);
// Stories を末尾に置く
export const storiesLast = withStories("last", false);
// Stories を先頭に置く。前のカードと同じエリアなら出さない（同じ 1 枚が続かない）
export const storiesFirstOnce = withStories("first", true);

type Entry = { version: number; run: CarouselStrategy };

// stories-first・stories-last の @2：Stories を絞り込んだエリアではなく、カードの地区で決める
const CAROUSEL: Record<string, Entry> = {
  "dest-only": { version: 1, run: destOnly },
  "stories-first": { version: 2, run: storiesFirst },
  "stories-last": { version: 2, run: storiesLast },
  "stories-first-once": { version: 1, run: storiesFirstOnce },
};

const DEFAULT = "stories-first-once";

// id は表示ログの algorithm に足す（例：carousel=stories-first-once@1）
export type CarouselEntry = { id: string; run: CarouselStrategy };

// 知らない名前・未設定は既定にする
export function loadCarouselStrategy(name: string | undefined = process.env.CAROUSEL_STRATEGY): CarouselEntry {
  const key = name && Object.hasOwn(CAROUSEL, name) ? name : DEFAULT;
  return { id: `carousel=${key}@${CAROUSEL[key].version}`, run: CAROUSEL[key].run };
}

// カルーセルの中の行き先のタイル
export function destTilesOf(items: CarouselItem[]): Tile[] {
  return items.flatMap((x) => (x.type === "dest" ? [x.tile] : []));
}
