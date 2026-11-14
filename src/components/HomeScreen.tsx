"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { DEFAULT_QUERY, serializeDiscoverQuery } from "@/lib/discover-query";
import { saveLastDiscoverUrl } from "@/lib/last-discover";
import type { AreaGroupView, CategoryView, DiscoverQuery, FeedCard, FeedPage, Photo, SortKey } from "@/lib/types";
import { Icon } from "./icons";
import { PhotoCarousel } from "./PhotoCarousel";

type Props = { query: DiscoverQuery; feed: FeedPage; categories: CategoryView[]; areas: AreaGroupView[] };
type Sheet = null | "area" | "filter" | "login";

const GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(16px) saturate(1.2)",
  WebkitBackdropFilter: "blur(16px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.14)",
};
const CHIP_ON: CSSProperties = { background: "#f4f1ea", color: "#141413", border: "1px solid #f4f1ea" };
const CHIP_OFF: CSSProperties = { background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)" };
const SORTS: { id: SortKey; label: string }[] = [
  { id: "editorial", label: "編集部のおすすめ" },
  { id: "fresh", label: "新着順" },
];

// 写真があれば写真、無ければデモ用の色面（空と地面）
function photoStyle(photo: Photo | null): CSSProperties {
  if (photo?.url && !photo.isDemo) {
    return { backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

function areaName(areas: AreaGroupView[], id: string): string {
  if (id === "all") return "全エリア";
  for (const g of areas) {
    if (g.id === id) return g.label;
    const sub = g.subs.find((s) => s.id === id);
    if (sub) return sub.label;
  }
  return "全エリア";
}

export function HomeScreen({ query, feed, categories, areas }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<Sheet>(null);

  // 全画面の詳細から戻るときのために、今の条件を控えておく
  useEffect(() => {
    saveLastDiscoverUrl(serializeDiscoverQuery(query));
  }, [query]);

  function go(next: Partial<DiscoverQuery>) {
    const merged: DiscoverQuery = { ...query, ...next };
    startTransition(() => {
      router.replace(serializeDiscoverQuery(merged), { scroll: false });
    });
  }

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    go({ q });
  }

  const isPlace = query.mode === "place";
  const allCats: CategoryView[] = [{ id: "all", label: "すべて", icon: "grid" }, ...categories];
  const currentArea = areaName(areas, query.area);

  return (
    <div data-home className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-[#0f0f0e] text-white">
      {/* Feed */}
      <div
        className="absolute inset-0 overflow-y-auto overscroll-y-contain pb-[190px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}
        aria-busy={isPending}
      >
        {feed.cards.map((card) => (
          <FeedCardView key={card.key} card={card} />
        ))}
        {feed.cards.length === 0 && (
          <div className="flex flex-col items-center gap-3.5 px-8 pt-[180px] text-center">
            <Icon name="search" size={40} />
            <p className="m-0 text-[17px] font-bold">条件に合うスポットがありません</p>
            <p className="m-0 text-[13px] leading-[1.7] text-white/80">エリアやカテゴリを変えるか、条件をリセットしてください。</p>
            <button
              type="button"
              onClick={() => go({ ...DEFAULT_QUERY, mode: query.mode })}
              className="mt-2 h-11 cursor-pointer rounded-xl border border-white/40 bg-transparent px-[18px] text-sm text-white"
            >
              条件をリセット
            </button>
          </div>
        )}
      </div>

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-[5] flex items-center justify-between px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold tracking-[0.24em] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">WANDRARA</span>
          <span className="text-[11px] text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">{feed.orderLabel} · デモ表示</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSheet("login")}
            aria-label="保存したスポットだけを表示"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white"
            style={GLASS}
          >
            <Icon name="heart" />
          </button>
        </div>
      </header>

      {/* Floating two-row overlay */}
      <div className="absolute inset-x-3 bottom-[22px] z-[6] flex flex-col gap-2">
        <nav aria-label="エリアとカテゴリ" className="flex items-center gap-1.5 rounded-[18px] p-1.5" style={GLASS}>
          <button
            type="button"
            onClick={() => setSheet("area")}
            aria-label={`エリアを選ぶ（現在：${currentArea}）`}
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
            onClick={() => go({ mode: isPlace ? "experience" : "place", cat: "all" })}
            aria-label={isPlace ? "場所から探す（タップで体験から探すに切り替え）" : "体験から探す（タップで場所から探すに切り替え）"}
            title={isPlace ? "場所から探す" : "体験から探す"}
            className="flex h-[52px] w-[52px] flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] text-white"
            style={GLASS}
          >
            <Icon name={isPlace ? "pin" : "sparkle"} />
            <span className="text-[10px] font-semibold">{isPlace ? "場所" : "体験"}</span>
          </button>
          <form
            role="search"
            onSubmit={onSearch}
            className="flex h-[52px] min-w-0 flex-auto items-center gap-2 rounded-[14px] px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#f4f1ea]"
            style={GLASS}
          >
            <Icon name="search" size={18} className="flex-none" />
            <label className="sr-only" htmlFor="discover-q">検索</label>
            <input
              key={query.q}
              id="discover-q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="どんな場所や体験を探す？"
              enterKeyHint="search"
              className="min-w-0 flex-auto border-0 bg-transparent text-base text-white outline-none placeholder:text-white/80"
            />
          </form>
          <button
            type="button"
            onClick={() => setSheet("filter")}
            aria-label={query.sort !== "editorial" ? "絞り込み（1件適用中）" : "絞り込み"}
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
        <BottomSheet label="エリアを選ぶ" onClose={() => setSheet(null)}>
          <SheetHeader title="エリアを選ぶ" onClose={() => setSheet(null)} />
          <div className="flex flex-wrap gap-2">
            <Chip on={query.area === "all"} onClick={() => { go({ area: "all" }); setSheet(null); }}>すべてのエリア</Chip>
          </div>
          {areas.map((g) => (
            <div key={g.id} className="flex flex-col gap-2.5">
              <h3 className="m-0 text-[13px] font-semibold text-white/85">{g.label}</h3>
              <div className="flex flex-wrap gap-2">
                <Chip on={query.area === g.id} onClick={() => { go({ area: g.id }); setSheet(null); }}>{g.label}全体</Chip>
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
        <BottomSheet label="絞り込み" onClose={() => setSheet(null)}>
          <SheetHeader title="絞り込み" onClose={() => setSheet(null)} />
          <div className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[13px] font-semibold text-white/85">並び順</h3>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Chip key={s.id} on={query.sort === s.id} onClick={() => go({ sort: s.id })}>{s.label}</Chip>
              ))}
            </div>
            <p className="m-0 text-[11px] text-white/70">料金・所要時間の絞り込みは次の版で追加します。</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span role="status" className="text-[13px] text-white/85">該当 {feed.cards.length}件</span>
            <button
              type="button"
              onClick={() => go({ sort: "editorial" })}
              className="h-11 cursor-pointer rounded-[14px] border border-white/30 bg-transparent px-4 text-sm text-white"
            >
              クリア
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Login placeholder */}
      {sheet === "login" && (
        <BottomSheet label="ログインが必要です" onClose={() => setSheet(null)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <Icon name="heart" size={32} />
            <h2 className="m-0 text-lg font-bold">保存するにはログインしてください</h2>
            <p className="m-0 text-[13px] leading-[1.7] text-white/80">ログインと保存は次の版で対応します。</p>
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="mt-2 h-12 w-full cursor-pointer rounded-[14px] border-0 bg-[#f4f1ea] text-[15px] font-bold text-[#141413]"
            >
              閉じる
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function FeedCardView({ card }: { card: FeedCard }) {
  return (
    <article className="flex flex-col">
      {/* 写真は横にスワイプで切り替え、タップで詳細を開く */}
      <PhotoCarousel photos={card.photos} href={card.href} label={card.title} className="h-[520px] text-white" counterClassName="right-4 top-[76px]">
        {(card.photos[0]?.isDemo ?? true) && (
          <span className="pointer-events-none absolute left-4 top-[76px] rounded-md bg-[rgba(15,15,14,0.6)] px-2 py-1 text-[11px] font-semibold tracking-[0.06em]">写真（デモ）</span>
        )}
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
          <div className="grid grid-cols-3 gap-1.5">
            {card.tiles.map((t) => (
              <Link key={t.spotId} href={t.href} className="flex flex-col gap-1.5 text-white no-underline">
                <span className="block h-28 rounded-[10px]" style={photoStyle(t.photo)} />
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
  return (
    <>
      <button type="button" aria-label={`${label}を閉じる`} onClick={onClose} className="absolute inset-0 z-[19] cursor-pointer border-0 bg-transparent" />
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
  return (
    <div className="flex items-center justify-between">
      <h2 className="m-0 text-lg font-bold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
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
