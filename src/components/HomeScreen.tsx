"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { DEFAULT_QUERY, serializeDiscoverQuery } from "@/lib/discover-query";
import { saveLastDiscoverUrl } from "@/lib/last-discover";
import { messages, type Messages } from "@/lib/i18n/messages";
import { useMessages } from "@/lib/i18n/use-locale";
import { otherMode } from "@/lib/modes";
import type { AreaGroupView, CategoryView, DiscoverQuery, FeedCard, FeedPage, Locale, Photo, SortKey } from "@/lib/types";
import { AccountButton } from "./AccountButton";
import { LanguageSwitch } from "./LanguageSwitch";
import { Icon } from "./icons";
import { PhotoCarousel } from "./PhotoCarousel";
import { SaveButton } from "./SaveButton";

type Props = { locale: Locale; query: DiscoverQuery; feed: FeedPage; categories: CategoryView[]; areas: AreaGroupView[] };
type Sheet = null | "area" | "filter";

const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(16px) saturate(1.2)",
  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.14)",
};
const CHIP_ON: CSSProperties = { background: "#f4f1ea", color: "#141413", border: "1px solid #f4f1ea" };
const CHIP_OFF: CSSProperties = { background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)" };
const sorts = (m: Messages): { id: SortKey; label: string }[] => [
  { id: "editorial", label: m.home.sortEditorial },
  { id: "fresh", label: m.home.sortFresh },
];

// 写真が無いときのデモ用の色面（空と地面）
function placeholderStyle(photo: Photo | null): CSSProperties {
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

// 一度に描くカードの数。全部を一度に描くと、写真の展開で iOS がメモリ不足になりページを閉じる
const FIRST_CARDS = 6;
const MORE_CARDS = 6;

function areaName(areas: AreaGroupView[], id: string, all: string): string {
  if (id === "all") return all;
  for (const g of areas) {
    if (g.id === id) return g.label;
    const sub = g.subs.find((s) => s.id === id);
    if (sub) return sub.label;
  }
  return all;
}

export function HomeScreen({ locale, query, feed, categories, areas }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<Sheet>(null);
  const m = messages(locale);

  // 全画面の詳細から戻るときのために、今の条件を控えておく
  useEffect(() => {
    saveLastDiscoverUrl(serializeDiscoverQuery(query, locale));
  }, [query, locale]);

  function go(next: Partial<DiscoverQuery>) {
    const merged: DiscoverQuery = { ...query, ...next };
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
  const currentArea = areaName(areas, query.area, m.home.allAreas);

  return (
    <div data-home className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-[#0f0f0e] text-white">
      {/* Feed */}
      <div
        data-feed
        data-feed-algorithm={feed.algorithm}
        className="absolute inset-0 overflow-y-auto pb-[190px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}
        aria-busy={isPending}
      >
        <FeedList key={serializeDiscoverQuery(query, locale)} cards={feed.cards} />
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

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold tracking-[0.24em] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">WANDRARA</span>
          <span className="text-[11px] text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">{feed.orderLabel} · {m.home.demo}</span>
        </div>
        <div className="flex gap-2">
          <LanguageSwitch
            locale={locale}
            className="flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-3 text-[13px] font-semibold text-white"
            style={GLASS}
          />
          <AccountButton
            locale={locale}
            next={serializeDiscoverQuery(query, locale)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white"
            style={GLASS}
          />
        </div>
      </header>

      {/* Floating two-row overlay */}
      <div className="absolute inset-x-3 bottom-[22px] z-[6] flex flex-col gap-2">
        <nav aria-label={m.home.navLabel} className="flex items-center gap-1.5 rounded-[18px] p-1.5" style={GLASS}>
          <button
            type="button"
            onClick={() => setSheet("area")}
            aria-label={m.home.chooseAreaNow(currentArea)}
            className="flex h-11 max-w-[128px] flex-none cursor-pointer items-center gap-[5px] rounded-xl pl-[9px] pr-2.5 text-[13px] font-semibold"
            style={query.area === "all" ? { background: "rgba(255,255,255,0.10)", color: "#ffffff" } : { background: "#f4f1ea", color: "#141413" }}
          >
            <Icon name="map" size={18} />
            <span className="truncate">{currentArea}</span>
            <Icon name="chevron-down" size={14} />
          </button>
          <span aria-hidden="true" className="h-6 w-px flex-none bg-white/20" />
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
                  style={on ? { background: "#f4f1ea", color: "#141413" } : { background: "rgba(255,255,255,0.10)", color: "#ffffff" }}
                >
                  <Icon name={c.icon} />
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go({ mode: otherMode(query.mode), cat: "all" })}
            aria-label={m.home.searchBySwitch(m.mode[query.mode], m.mode[otherMode(query.mode)])}
            title={m.home.searchBy(m.mode[query.mode])}
            className="flex h-[52px] w-[52px] flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] text-white"
            style={GLASS}
          >
            <Icon name={isStay ? "pin" : "sparkle"} />
            <span className="text-[10px] font-semibold">{m.mode[query.mode]}</span>
          </button>
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
      </div>

      {/* Area sheet */}
      {sheet === "area" && (
        <BottomSheet label={m.home.chooseArea} onClose={() => setSheet(null)}>
          <SheetHeader title={m.home.chooseArea} onClose={() => setSheet(null)} />
          <div className="flex flex-wrap gap-2">
            <Chip on={query.area === "all"} onClick={() => { go({ area: "all" }); setSheet(null); }}>{m.home.allAreasChip}</Chip>
          </div>
          {areas.map((g) => (
            <div key={g.id} className="flex flex-col gap-2.5">
              <h3 className="m-0 text-[13px] font-semibold text-white/85">{g.label}</h3>
              <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-2">
              {sorts(m).map((s) => (
                <Chip key={s.id} on={query.sort === s.id} onClick={() => go({ sort: s.id })}>{s.label}</Chip>
              ))}
            </div>
            <p className="m-0 text-[11px] text-white/70">{m.home.filterLater}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span role="status" className="text-[13px] text-white/85">{m.home.hits(feed.cards.length)}</span>
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

// 最初は FIRST_CARDS 枚だけ描き、終わりに近づいたら MORE_CARDS 枚ずつ足す。条件が変わると key で最初に戻る
function FeedList({ cards }: { cards: FeedCard[] }) {
  const [shown, setShown] = useState(FIRST_CARDS);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= cards.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.min(cards.length, n + MORE_CARDS));
      },
      { root: el.closest("[data-feed]"), rootMargin: "0px 0px 1500px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, cards.length]);

  return (
    <>
      {cards.slice(0, shown).map((card, i) => (
        <FeedCardView key={card.key} card={card} first={i === 0} />
      ))}
      {shown < cards.length && <div ref={sentinel} aria-hidden="true" className="h-px" />}
    </>
  );
}

// 画面の外のカードは描画を省く（content-visibility）。最初のカードだけ写真を先に読む
const OFFSCREEN: CSSProperties = { contentVisibility: "auto", containIntrinsicSize: "auto 760px" };

function FeedCardView({ card, first }: { card: FeedCard; first: boolean }) {
  const m = useMessages();
  return (
    <article className="flex flex-col" style={first ? undefined : OFFSCREEN}>
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
      {card.tiles.length > 0 && (
        <section className="flex flex-col gap-2.5 px-3 pb-7 pt-3.5">
          <h2 className="m-0 text-xs font-semibold tracking-[0.04em] text-white/75">{card.relLabel}</h2>
          {/* 横にスワイプして送る。3 枚目が少し覗く幅にして続きがあると分かるようにする */}
          <div className="-mx-3 flex snap-x snap-mandatory gap-1.5 overflow-x-auto scroll-px-3 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {card.tiles.map((t) => (
              <Link key={t.destId} href={t.href} className="flex w-[38%] shrink-0 snap-start flex-col gap-1.5 text-white no-underline">
                {t.photo?.url && !t.photo.isDemo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.photo.url} alt="" loading="lazy" decoding="async" className="block aspect-square w-full rounded-[10px] object-cover" />
                ) : (
                  <span className="block aspect-square w-full rounded-[10px]" style={placeholderStyle(t.photo)} />
                )}
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs leading-[1.4]">{t.label}</span>
                  {t.sub && <span className="text-[11px] text-white/70">{t.sub}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function BottomSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const m = useMessages();
  return (
    <>
      <button type="button" aria-label={m.home.closeSheet(label)} onClick={onClose} className="absolute inset-0 z-[19] cursor-pointer border-0 bg-transparent" />
      <section
        role="dialog"
        aria-label={label}
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="h-10 cursor-pointer rounded-full px-3.5 text-[13px]"
      style={on ? CHIP_ON : CHIP_OFF}
    >
      {children}
    </button>
  );
}
