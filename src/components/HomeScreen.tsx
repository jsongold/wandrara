"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { areaHighlights } from "@/lib/area-highlights";
import { DEFAULT_QUERY, serializeDiscoverQuery } from "@/lib/discover-query";
import { clickEventOf, trackFeedEvent, viewedEnough, type FeedEvent } from "@/lib/feed-events";
import { apiFetchPage, FeedPager, nextPageHref } from "@/lib/feed-pager";
import type { FeedPageResult } from "@/lib/feed-page";
import { saveLastDiscoverUrl } from "@/lib/last-discover";
import { messages, type Messages } from "@/lib/i18n/messages";
import { useMessages } from "@/lib/i18n/use-locale";
import { SaveDataHint, useSaveData } from "@/lib/use-save-data";
import { otherMode } from "@/lib/modes";
import { areaSheetLoader, IDLE_AREA_SHEET } from "@/lib/area-sheet-client";
import type { CategoryView, DiscoverQuery, FeedCard, Locale, SortKey } from "@/lib/types";
import { AreaMap } from "./AreaMap";
import { AreaStories } from "./area-stories/AreaStories";
import { Chip } from "./Chip";
import { CurrentFilterDisplay } from "./CurrentFilterDisplay";
import { HomeHeader } from "./HomeHeader";
import { Icon } from "./icons";
import { NearbySuggestions } from "./NearbySuggestions";
import { PhotoCarousel } from "./PhotoCarousel";
import { SaveButton } from "./SaveButton";
import { useScrolledAway } from "./use-scrolled-away";

// saveData：サーバーが決めた「通信量を抑える」（最初の描画に使う。以降はクライアントの値に従う）
type Props = { locale: Locale; query: DiscoverQuery; feed: FeedPageResult; categories: CategoryView[]; areaLabel: string | null; saveData?: boolean };
type Sheet = null | "area" | "filter";
type AreaView = "list" | "map";

const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(16px) saturate(1.2)",
  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.14)",
};
// ヘッダーのアカウントのアイコン。透けない色（写真の上でも形がはっきり見える）
const ICON_SOLID: CSSProperties = { background: "#1a1a18", border: "1px solid rgba(255,255,255,0.14)", color: "#ffffff" };
// 下に浮かぶアイコン。外枠は無く、1 つずつがガラスの上に乗る
const ICON_OFF: CSSProperties = { ...GLASS, color: "#ffffff" };
const ICON_ON: CSSProperties = { background: "#f4f1ea", color: "#141413", border: "1px solid #f4f1ea" };
const sorts = (m: Messages): { id: SortKey; label: string }[] => [
  { id: "editorial", label: m.home.sortEditorial },
  { id: "fresh", label: m.home.sortFresh },
];

// トップのテキスト入力とフィルター。今は Off
const SHOW_SEARCH_AND_FILTER = false;

// areaLabel：今のエリアの名前（サーバーが渡す。「すべてのエリア」・知らない id は null）。エリアの一覧・地図に要る地域と特性は、シートを開いたときに取る（MS2c）
export function HomeScreen({ saveData = false, ...props }: Props) {
  return (
    <SaveDataHint value={saveData}>
      <HomeScreenBody {...props} />
    </SaveDataHint>
  );
}

function HomeScreenBody({ locale, query, feed, categories, areaLabel }: Omit<Props, "saveData">) {
  const saveData = useSaveData();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [areaView, setAreaView] = useState<AreaView>("list");
  const m = messages(locale);
  const feedRef = useRef<HTMLDivElement>(null);
  // 一覧がいちばん上から離れたか（ヘッダーのタイトルを畳む）
  const scrolledAway = useScrolledAway(feedRef);
  // エリア選択シートのデータ（シートを開く・ボタンに触れた時点で取り始める）
  const areaSheet = useSyncExternalStore(areaSheetLoader.subscribe, () => areaSheetLoader.get(locale), () => IDLE_AREA_SHEET);
  const areaData = areaSheet.status === "ready" ? areaSheet.data : null;
  const loadAreaSheet = () => areaSheetLoader.load(locale);
  // 最初の表示が落ち着いたら先に取っておく（開く待ちを無くす。通信量を節約したい利用者（Save-Data）には先読みしない。その場合は触れた時点で取る）
  useEffect(() => {
    if (saveData) return;
    const load = () => areaSheetLoader.load(locale);
    // requestIdleCallback は Safari に無いので、その場合は少し待ってから
    const w: { requestIdleCallback?: typeof window.requestIdleCallback; cancelIdleCallback?: typeof window.cancelIdleCallback } = window;
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(load, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = setTimeout(load, 2000);
    return () => clearTimeout(id);
  }, [locale, saveData]);
  // 地図の絞り込みで、子に合うものがあれば親も残すための親子
  const parentOf = useMemo(
    () => Object.fromEntries((areaData?.areas ?? []).flatMap((g) => [[g.id, null], ...g.subs.map((s) => [s.id, g.id])])) as Record<string, string | null>,
    [areaData],
  );
  const labelById = useMemo(() => new Map((areaData?.areas ?? []).flatMap((g) => [[g.id, g.label], ...g.subs.map((x) => [x.id, x.label] as const)] as [string, string][])), [areaData]);
  const queryKey = serializeDiscoverQuery(query, locale);
  // 一覧の同一性：条件に加えて、サーバーが渡した最初のカード（?after= の続きから開いた・先頭に戻った、でも作り直す）
  const feedKey = `${queryKey}|${feed.cards[0]?.destId ?? ""}`;

  // 条件（カテゴリなど）が変わり新しい一覧が来たら、一覧の一番上から見せる
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 });
  }, [feedKey]);

  // 全画面の詳細から戻るときのために、今の条件を控えておく
  useEffect(() => {
    saveLastDiscoverUrl(serializeDiscoverQuery(query, locale));
  }, [query, locale]);

  // 表示とクリックの記録。どの並べ方（feed.algorithm）で出したかを毎回付ける
  const { algorithm } = feed;
  const { mode, sort, area, cat, q } = query;
  const track = useCallback(
    (e: FeedEvent) => trackFeedEvent({ algorithm, mode, sort, area, cat, q }, e),
    [algorithm, mode, sort, area, cat, q],
  );
  // 最初に出した枚数と総件数（続きを読んでも、この表示の feed_view は 1 回）
  const count = feed.cards.length;
  const { total, totalIsLowerBound } = feed;
  useEffect(() => {
    track({ name: "feed_view", count, total, totalIsLowerBound });
  }, [track, count, total, totalIsLowerBound]);

  function go(next: Partial<DiscoverQuery>) {
    // テキスト入力を出していない間は、URL に残った q を次の操作で外す（見えない絞り込みを残さない）
    const merged: DiscoverQuery = { ...query, ...(SHOW_SEARCH_AND_FILTER ? {} : { q: "" }), ...next };
    startTransition(() => {
      router.replace(serializeDiscoverQuery(merged, locale), { scroll: false });
    });
  }

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    go({ q });
  }

  const isStay = query.mode === "stay";
  const allCats: CategoryView[] = [{ id: "all", label: m.home.allCats, icon: "grid" }, ...categories];
  const currentArea = areaLabel ?? m.home.allAreas;
  const highlights = areaHighlights(query.area, locale);

  return (
    <div data-home className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-[#0f0f0e] text-white">
      {/* Feed */}
      <div
        ref={feedRef}
        data-feed
        data-feed-algorithm={feed.algorithm}
        data-feed-total={feed.total ?? undefined}
        data-feed-total-lower-bound={feed.totalIsLowerBound || undefined}
        className="absolute inset-0 overflow-y-auto pb-[120px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}
        aria-busy={isPending}
      >
        <FeedList key={feedKey} feed={feed} query={query} locale={locale} track={track} />
        {feed.cards.length === 0 && (
          <div className="flex flex-col items-center gap-3.5 px-8 pt-[180px] text-center">
            <Icon name="search" size={40} />
            <p className="m-0 text-[17px] font-bold">{m.home.empty}</p>
            <p className="m-0 text-[13px] leading-[1.7] text-white/80">{m.home.emptyHint}</p>
            <button
              type="button"
              onClick={() => go({ ...DEFAULT_QUERY, mode: query.mode })}
              className="mt-2 h-11 cursor-pointer rounded-xl border border-white/40 bg-transparent px-[18px] text-sm text-white"
            >
              {m.home.reset}
            </button>
          </div>
        )}
      </div>

      {/* Top bar。エリアの名前は、エリアの一言があればそれを開くボタン（全国・データの無いエリアでは名前だけ） */}
      <HomeHeader
        locale={locale}
        next={serializeDiscoverQuery(query, locale)}
        subtitle={`${feed.orderLabel} · ${m.home.demo}`}
        iconStyle={ICON_SOLID}
        collapsed={scrolledAway}
        area={
          highlights.length > 0 ? (
            <AreaStories locale={locale} area={query.area} areaLabel={currentArea} groups={highlights} scrollRoot={feedRef} />
          ) : (
            <CurrentFilterDisplay label={query.area === "all" || currentArea === m.home.allAreas ? null : currentArea} className="min-w-0" />
          )
        }
      />

      {/* Floating overlay */}
      {/* 横幅は画面の 80% まで、中央に置く */}
      <div className="absolute inset-x-0 bottom-[22px] z-[6] mx-auto flex w-[80%] flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => go({ mode: otherMode(query.mode), cat: "all" })}
            aria-label={m.home.searchBySwitch(m.mode[query.mode], m.mode[otherMode(query.mode)])}
            title={m.home.searchBy(m.mode[query.mode])}
            className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-xl"
            style={ICON_OFF}
          >
            <Icon name={isStay ? "pin" : "sparkle"} />
          </button>
          <nav aria-label={m.home.navLabel} className="flex min-w-0 flex-auto items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                loadAreaSheet();
                setSheet("area");
              }}
              // 押す前（触れた・フォーカスした）に取り始める。押した時点では取得中か取得済みになる
              onPointerDown={loadAreaSheet}
              onFocus={loadAreaSheet}
              aria-label={m.home.chooseAreaNow(currentArea)}
              title={currentArea}
              className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-xl"
              style={query.area === "all" ? ICON_OFF : ICON_ON}
            >
              <Icon name="map" />
            </button>
            <span aria-hidden="true" className="h-6 w-px flex-none bg-white/40" />
            <div className="flex min-w-0 flex-auto gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {allCats.map((c) => {
                const on = c.id === query.cat;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => go({ cat: c.id })}
                    aria-label={c.label}
                    aria-pressed={on}
                    title={c.label}
                    className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-xl"
                    style={on ? ICON_ON : ICON_OFF}
                  >
                    <Icon name={c.icon} />
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* テキスト入力とフィルターは今は出さない */}
        {SHOW_SEARCH_AND_FILTER && (
          <div className="flex items-center gap-2">
            <form
              role="search"
              onSubmit={onSearch}
              className="flex h-[52px] min-w-0 flex-auto items-center gap-2 rounded-[14px] px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f4f1ea]"
              style={GLASS}
            >
              <Icon name="search" size={18} className="flex-none" />
              <label className="sr-only" htmlFor="discover-q">{m.home.search}</label>
              <input
                key={query.q}
                id="discover-q"
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder={m.home.searchPlaceholder}
                enterKeyHint="search"
                className="min-w-0 flex-auto border-0 bg-transparent text-base text-white outline-none placeholder:text-white/80"
              />
            </form>
            <button
              type="button"
              onClick={() => setSheet("filter")}
              aria-label={query.sort !== "editorial" ? m.home.filterActive : m.home.filter}
              className="relative flex h-[52px] w-[52px] flex-none cursor-pointer items-center justify-center rounded-[14px] text-white"
              style={GLASS}
            >
              <Icon name="filter" />
              {query.sort !== "editorial" && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#f4f1ea]" />}
            </button>
          </div>
        )}
      </div>

      {/* Area sheet */}
      {sheet === "area" && (
        <BottomSheet
          label={m.home.chooseArea}
          onClose={() => setSheet(null)}
          // リストと地図で高さを変えない（地図はこの中に収める）
          height="min(700px, 85svh)"
        >
          <SheetHeader title={m.home.chooseArea} onClose={() => setSheet(null)} />
          <div role="group" aria-label={m.home.areaView} className="grid grid-cols-2 rounded-xl bg-white/[0.08] p-[3px]">
            {(["list", "map"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={areaView === v}
                onClick={() => setAreaView(v)}
                className="h-9 cursor-pointer rounded-[10px] border-0 text-[13px] font-semibold"
                style={areaView === v ? { background: "#f4f1ea", color: "#141413" } : { background: "transparent", color: "rgba(255,255,255,0.7)" }}
              >
                {v === "list" ? m.home.areaViewList : m.home.areaViewMap}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5">
            <Chip on={query.area === "all"} onClick={() => { go({ area: "all" }); setSheet(null); }}>{m.home.allAreasChip}</Chip>
          </div>
          {areaSheet.status === "error" && (
            <button type="button" onClick={loadAreaSheet} className="h-11 cursor-pointer self-start rounded-xl border border-white/40 bg-transparent px-[18px] text-sm text-white">
              {m.home.moreFailed}
            </button>
          )}
          {areaSheet.status !== "ready" && areaSheet.status !== "error" && <p role="status" className="m-0 text-[13px] text-white/70">{m.common.loading}</p>}
          {areaData && areaView === "map" && (
            <AreaMap
              current={query.area}
              labelOf={(id) => labelById.get(id) ?? id}
              parentOf={parentOf}
              traits={areaData.traits}
              // 地図では選んでもシートを閉じない（続けて寄ったり選び直したりできる）
              onSelect={(id) => go({ area: id })}
            />
          )}
          {areaData && areaView === "list" && areaData.areas.map((g) => (
            <div key={g.id} className="flex flex-col gap-2.5">
              <h3 className="m-0 text-[13px] font-semibold text-white/85">{g.label}</h3>
              <div className="flex flex-wrap gap-x-5">
                <Chip on={query.area === g.id} onClick={() => { go({ area: g.id }); setSheet(null); }}>{m.home.areaWhole(g.label)}</Chip>
                {g.subs.map((s) => (
                  <Chip key={s.id} on={query.area === s.id} onClick={() => { go({ area: s.id }); setSheet(null); }}>{s.label}</Chip>
                ))}
              </div>
            </div>
          ))}
        </BottomSheet>
      )}

      {/* Filter sheet */}
      {sheet === "filter" && (
        <BottomSheet label={m.home.filter} onClose={() => setSheet(null)}>
          <SheetHeader title={m.home.filter} onClose={() => setSheet(null)} />
          <div className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[13px] font-semibold text-white/85">{m.home.sortHeading}</h3>
            <div className="flex flex-wrap gap-x-5">
              {sorts(m).map((s) => (
                <Chip key={s.id} on={query.sort === s.id} onClick={() => go({ sort: s.id })}>{s.label}</Chip>
              ))}
            </div>
            <p className="m-0 text-[11px] text-white/70">{m.home.filterLater}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span role="status" className="text-[13px] text-white/85">
              {feed.total === null ? m.home.hits(feed.cards.length) : feed.totalIsLowerBound ? m.home.hitsAtLeast(feed.total) : m.home.hits(feed.total)}
            </span>
            <button
              type="button"
              onClick={() => go({ sort: "editorial" })}
              className="h-11 cursor-pointer rounded-[14px] border border-white/30 bg-transparent px-4 text-sm text-white"
            >
              {m.home.clear}
            </button>
          </div>
        </BottomSheet>
      )}

    </div>
  );
}

// 最初のページはサーバーが渡し、終わりに近づいたら /api/feed で続きを足す（FeedPager）。条件が変わると key で作り直し、進行中の取得は止める。
// 続きの枠は overflow-anchor: none（入った分だけブラウザが位置を補正すると、スクロールが送られて次の取得が連鎖する）。
// 続きのリンクは検索エンジンがたどる普通の <a>（?after=cursor）。JS が動くときは押すと loadMore になり、失敗したときの再試行も兼ねる
function FeedList({ feed, query, locale, track }: { feed: FeedPageResult; query: DiscoverQuery; locale: Locale; track: (e: FeedEvent) => void }) {
  const m = messages(locale);
  const [pager] = useState(() => new FeedPager(feed, apiFetchPage(query, locale)));
  useEffect(() => () => pager.dispose(), [pager]);
  const s = useSyncExternalStore(pager.subscribe, pager.getSnapshot, pager.getSnapshot);
  const sentinel = useRef<HTMLDivElement>(null);
  const idle = s.status === "idle";

  // 失敗したときは自動で再取得しない（押されたら loadMore）。取得のたびに観察し直すので、まだ見えていれば続けて取る
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !s.nextCursor || !idle) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void pager.loadMore();
      },
      { root: el.closest("[data-feed]"), rootMargin: "0px 0px 1500px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pager, s.nextCursor, s.cards.length, idle]);

  return (
    <>
      {s.cards.map((card, i) => (
        <FeedCardView key={card.key} card={card} position={i} track={track} />
      ))}
      {s.nextCursor && (
        <div ref={sentinel} className="flex flex-col items-center gap-1 px-4 pb-6 pt-2 text-center text-[13px] text-white/80 [overflow-anchor:none]">
          <a
            href={nextPageHref(serializeDiscoverQuery(query, locale), s.nextCursor)}
            rel="next"
            aria-busy={s.status === "loading"}
            onClick={(e) => {
              e.preventDefault();
              void pager.loadMore();
            }}
            className="text-white underline underline-offset-4"
          >
            {s.status === "error" ? m.home.moreFailed : s.status === "loading" ? m.home.moreLoading : m.home.more}
          </a>
          <span>{m.home.moreCount(s.cards.length, s.total, s.totalIsLowerBound)}</span>
        </div>
      )}
    </>
  );
}

// 画面の外のカードは描画を省く（content-visibility）。最初のカードだけ写真を先に読む
const OFFSCREEN: CSSProperties = { contentVisibility: "auto", containIntrinsicSize: "auto 760px" };

// 半分以上見えたら 1 回だけ card_view を残す
const VIEW_THRESHOLD = 0.5;

function FeedCardView({ card, position, track }: { card: FeedCard; position: number; track: (e: FeedEvent) => void }) {
  const m = useMessages();
  const first = position === 0;
  const ref = useRef<HTMLElement>(null);
  const { destId } = card;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!viewedEnough(entries, VIEW_THRESHOLD)) return;
        track({ name: "card_view", destId, position });
        io.disconnect();
      },
      { root: el.closest("[data-feed]"), threshold: VIEW_THRESHOLD },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [track, destId, position]);

  // Link は画面内の遷移のために preventDefault するので defaultPrevented では見ない。
  // スワイプの残りのクリックは PhotoCarousel が capture で stopPropagation するので、ここには来ない
  function onClick(e: MouseEvent<HTMLElement>) {
    const a = (e.target as Element).closest("a");
    const event = clickEventOf(a && { tileDestId: a.getAttribute("data-tile-dest-id"), tilePosition: a.getAttribute("data-tile-position") }, { destId, position });
    if (event) track(event);
  }

  return (
    <article ref={ref} onClick={onClick} className="flex flex-col" style={first ? undefined : OFFSCREEN}>
      {/* 写真は横にスワイプで切り替え、タップで詳細を開く */}
      <PhotoCarousel photos={card.photos} href={card.href} label={card.title} className="h-[520px] text-white" counterClassName="right-4 top-[76px]" priority={first}>
        {(card.photos[0]?.isDemo ?? true) && (
          <span className="pointer-events-none absolute left-4 top-[76px] rounded-md bg-[rgba(15,15,14,0.6)] px-2 py-1 text-[11px] font-semibold tracking-[0.06em]">{m.home.photoDemo}</span>
        )}
        {/* 写真の枚数表示（right-4 top-[76px]）の下。ボタンだけ押せる */}
        <SaveButton destId={card.destId} variant="card" className="absolute right-3 top-[104px]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-b from-transparent to-black/60" />
        <span className="pointer-events-none absolute inset-x-4 bottom-5 flex flex-col gap-1.5">
          <span className="self-start rounded-md border border-white/50 px-2 py-[3px] text-[11px] font-semibold">{card.kindLabel}</span>
          <span className="text-2xl font-bold leading-[1.3]">{card.title}</span>
          <span className="text-[13px] text-white/90">{card.areaLabel}</span>
        </span>
      </PhotoCarousel>
      <NearbySuggestions title={card.relLabel} tiles={card.tiles} />
    </article>
  );
}

function BottomSheet({
  label,
  onClose,
  children,
  height,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  height?: string;
}) {
  const m = useMessages();
  return (
    <>
      <button type="button" aria-label={m.home.closeSheet(label)} onClick={onClose} className="absolute inset-0 z-[19] cursor-pointer border-0 bg-transparent" />
      <section
        role="dialog"
        aria-label={label}
        style={height ? { height } : undefined}
        className="absolute inset-x-0 bottom-0 z-20 flex max-h-[700px] flex-col gap-5 overflow-y-auto rounded-t-3xl bg-[#1b1b19] px-5 pb-7 pt-5"
      >
        {children}
      </section>
    </>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const m = useMessages();
  return (
    <div className="flex items-center justify-between">
      <h2 className="m-0 text-lg font-bold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={m.common.close}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-white"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

