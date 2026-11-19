"use client";

// area-stories：エリアの一言（F 案「写真の丸＋ストーリー」）。ヘッダーの下に項目ごとの丸い写真を並べ、押すと全画面で候補を順に見せる
// 見たかどうかは端末ごと（localStorage）に覚える。ログインした利用者ごとに覚えるかは未決定
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { HighlightGroup, HighlightItem, HighlightKind, HighlightOffer } from "@/lib/area-highlights";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { Icon } from "./icons";

type Props = { locale: Locale; area: string; areaLabel: string; groups: HighlightGroup[] };
type Open = { g: number; i: number };
type PeekView = "info" | "shops";

const seenKey = (area: string) => `wandrara:highlights-seen:${area}`;

const SEEN_EVENT = "wandrara:highlights-seen";

function readSeen(area: string): string {
  try {
    return localStorage.getItem(seenKey(area)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseSeen(raw: string): HighlightKind[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function markSeen(area: string, kind: HighlightKind) {
  const cur = parseSeen(readSeen(area));
  if (cur.includes(kind)) return;
  try {
    localStorage.setItem(seenKey(area), JSON.stringify([...cur, kind]));
  } catch {
    // 保存できない端末（プライベートモードなど）では、毎回まだ見ていない扱いにする
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(cb: () => void) {
  window.addEventListener(SEEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SEEN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// 次の候補。項目の最後なら次の項目の最初、全部見たら null（閉じる）
export function nextPos(groups: HighlightGroup[], p: Open): Open | null {
  if (p.i + 1 < groups[p.g].items.length) return { g: p.g, i: p.i + 1 };
  if (p.g + 1 < groups.length) return { g: p.g + 1, i: 0 };
  return null;
}

// 前の候補。項目の最初なら前の項目の最後、いちばん最初ならそのまま
export function prevPos(groups: HighlightGroup[], p: Open): Open {
  if (p.i > 0) return { g: p.g, i: p.i - 1 };
  if (p.g > 0) return { g: p.g - 1, i: groups[p.g - 1].items.length - 1 };
  return p;
}

const photo = (color: string): CSSProperties => ({ background: `linear-gradient(160deg, ${color} 0%, #1b1b19 130%)` });

// 候補の写真。写真が無ければ色面（試作。MS1 で next/image と丸用の小さい画像にする）
function ItemPhoto({ item, className }: { item: HighlightItem; className: string }) {
  if (!item.photo) return <span aria-hidden="true" className={`block ${className}`} style={photo(item.color)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.photo.url} alt="" className={`block object-cover ${className}`} />;
}

export function AreaStories({ locale, area, areaLabel, groups }: Props) {
  const m = messages(locale).highlights;
  const common = messages(locale).common;
  const seen = parseSeen(useSyncExternalStore(subscribeSeen, () => readSeen(area), () => "[]"));
  // peek：null は閉じている、info は「軽く見る」、shops は「購入先」の一覧
  const [openState, setOpenState] = useState<{ area: string; pos: Open; peek: PeekView | null } | null>(null);
  // エリアが変わったら閉じる
  const open = openState?.area === area ? openState.pos : null;
  // 「軽く見る」のシートを開いているか。候補を移ると閉じる
  const peekView = open !== null ? (openState?.peek ?? null) : null;
  const peek = peekView !== null;
  const setOpen = (next: Open | null) => {
    // 開いた項目を「見た」にする
    if (next && groups[next.g]) markSeen(area, groups[next.g].kind);
    setOpenState(next ? { area, pos: next, peek: null } : null);
  };
  const setPeekView = (v: PeekView | null) => setOpenState((s) => (s ? { ...s, peek: v } : s));
  const peekCloseRef = useRef<HTMLButtonElement>(null);
  const peekOpenRef = useRef<HTMLButtonElement>(null);
  // 開いたらシートの閉じるへ、閉じたら「軽く見る」へフォーカスを移す。閉じた直後は inert が外れてから移す
  const wasPeek = useRef(false);
  useEffect(() => {
    if (peek) peekCloseRef.current?.focus();
    else if (wasPeek.current) peekOpenRef.current?.focus();
    wasPeek.current = peek;
  }, [peek]);
  const closePeek = () => setPeekView(null);

  // ストーリーはモーダルの <dialog> で開く。開いている間は後ろの画面にフォーカスが行かず、閉じたら押した丸に戻る
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = open !== null;
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) {
      d.close();
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!open || peek) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen(nextPos(groups, open));
      if (e.key === "ArrowLeft") setOpen(prevPos(groups, open));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (groups.length === 0) return null;

  const cur = open ? groups[open.g] : null;
  const item = open && cur ? cur.items[open.i] : null;

  return (
    <>
      <nav
        aria-label={m.label(areaLabel)}
        data-testid="area-stories"
        className="filter-mark-in absolute inset-x-0 top-[72px] z-[5] flex gap-3.5 overflow-x-auto px-4 pb-2 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: "rgba(15,15,14,0.32)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      >
        {groups.map((g, gi) => {
          const isSeen = seen.includes(g.kind);
          return (
            <button
              key={g.kind}
              type="button"
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                setOpen({ g: gi, i: 0 });
              }}
              aria-label={m.open(m.kind[g.kind], g.items.length)}
              data-seen={isSeen}
              className="flex w-14 flex-none cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-white"
            >
              <span
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                style={{ border: `2px solid ${isSeen ? "rgba(255,255,255,0.35)" : "#f4f1ea"}` }}
              >
                <ItemPhoto item={g.items[0]} className="h-11 w-11 rounded-full" />
              </span>
              <span className={`text-[11px] ${isSeen ? "text-white/70" : "font-semibold"}`}>{m.kind[g.kind]}</span>
            </button>
          );
        })}
      </nav>

      {/* Esc はブラウザの cancel で閉じる。dialog は top layer に出るので、アプリの幅（480px）に合わせて置く */}
      <dialog
        ref={dialogRef}
        aria-label={cur ? m.kind[cur.kind] : undefined}
        onCancel={(e) => {
          e.preventDefault();
          // Esc は「軽く見る」を先に閉じる
          if (peek) closePeek();
          else setOpen(null);
        }}
        className="m-0 mx-auto h-[100dvh] max-h-none w-full max-w-[480px] border-0 bg-transparent p-0 text-white backdrop:bg-black/60"
      >
      {open && cur && item && (
        <div
          data-testid="area-story"
          className="relative flex h-full flex-col text-white"
          style={photo(item.color)}
        >
          {item.photo && <ItemPhoto item={item} className="absolute inset-0 h-full w-full" />}
          {/* 「軽く見る」を開いている間は、後ろのストーリーの操作を inert にしてフォーカスを入れない */}
          <div className="contents" inert={peek}>
          <div className="relative z-[2] flex gap-1 px-3 pt-3" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))" }}>
            {cur.items.map((_, i) => (
              <span key={i} className="h-[3px] flex-1 rounded-full" style={{ background: i <= open.i ? "#ffffff" : "rgba(255,255,255,0.35)" }} />
            ))}
          </div>
          <div className="relative z-[2] flex items-center justify-between px-4 pt-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{m.kind[cur.kind]}</span>
              <span className="text-[11px] text-white/80">{m.position(areaLabel, open.i + 1, cur.items.length)}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label={common.close}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white"
            >
              <Icon name="close" />
            </button>
          </div>

          {/* 左 35% で前、残りで次 */}
          <button type="button" aria-label={m.prev} onClick={() => setOpen(prevPos(groups, open))} className="absolute bottom-[180px] left-0 top-[80px] z-[1] w-[35%] cursor-pointer border-0 bg-transparent" />
          <button type="button" aria-label={m.next} onClick={() => setOpen(nextPos(groups, open))} className="absolute bottom-[180px] right-0 top-[80px] z-[1] w-[65%] cursor-pointer border-0 bg-transparent" />

          <div className="relative z-[2] mt-auto flex flex-col gap-2 px-5 pb-10" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55) 30%)" }}>
            <p className="m-0 pt-8 text-[28px] font-bold leading-tight">{item.name}</p>
            <p className="m-0 text-sm text-white/90">{item.note}</p>
            <div className="flex items-center gap-2 pt-2">
              <button
                ref={peekOpenRef}
                type="button"
                onClick={() => setPeekView("info")}
                aria-expanded={peek}
                className="h-11 cursor-pointer rounded-full border-0 px-5 text-sm font-semibold"
                style={{ background: "#f4f1ea", color: "#141413" }}
              >
                {m.peek}
              </button>
            </div>
          </div>
          </div>

          {/* 軽く見る：ストーリーの上に出す小さなシート。後で店・借りる先・dest への行き先を足す */}
          {peek && (
            <>
              <button type="button" tabIndex={-1} aria-hidden="true" onClick={closePeek} className="absolute inset-0 z-[3] cursor-pointer border-0 bg-black/40" />
              <section
                aria-label={item.name}
                data-testid="area-story-peek"
                className="filter-mark-in absolute inset-x-0 bottom-0 z-[4] flex max-h-[85%] flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-3xl bg-[#1b1b19] px-5 pb-8 pt-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] text-white/70">{peekView === "shops" ? m.shopsOf : `${m.kind[cur.kind]} · ${areaLabel}`}</span>
                    <p className="m-0 text-[20px] font-bold leading-snug">{item.name}</p>
                  </div>
                  <button
                    ref={peekCloseRef}
                    type="button"
                    onClick={closePeek}
                    aria-label={common.close}
                    className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-white/[0.08] text-white"
                  >
                    <Icon name="close" />
                  </button>
                </div>
                {peekView === "info" ? (
                  <PeekInfo item={item} m={m} onShops={() => setPeekView("shops")} />
                ) : (
                  <PeekShops item={item} m={m} onBack={() => setPeekView("info")} />
                )}
              </section>
            </>
          )}
        </div>
      )}
      </dialog>
    </>
  );
}

type HM = ReturnType<typeof messages>["highlights"];

// 軽く見る：写真・説明・旬・購入先を探す（扱う店が無ければ出さない）
function PeekInfo({ item, m, onShops }: { item: HighlightItem; m: HM; onShops: () => void }) {
  return (
    <>
      <ItemPhoto item={item} className="h-40 w-full flex-none rounded-2xl" />
      {item.photo && <span className="-mt-2 text-[10px] text-white/50">{m.photoCredit(item.photo.credit, item.photo.license)}</span>}
      {item.season && <span className="self-start rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px]">{m.season(item.season.from, item.season.to)}</span>}
      <p className="m-0 text-sm leading-relaxed text-white/90">{item.description}</p>
      {item.offers.length > 0 && (
        <button
          type="button"
          onClick={onShops}
          className="mt-1 flex h-12 cursor-pointer items-center justify-between rounded-2xl border-0 px-4 text-sm font-semibold"
          style={{ background: "#f4f1ea", color: "#141413" }}
        >
          <span>{item.type === "service" ? m.findWhereDo : m.findWhereBuy}</span>
          <span className="text-xs font-normal">{m.shopCount(item.offers.length)}</span>
        </button>
      )}
    </>
  );
}

// 購入先：扱う店の一覧。1 行に「店のサイトへ」（外部）と「ここで買う」（自社購入。試作ではまだ使えない）
function PeekShops({ item, m, onBack }: { item: HighlightItem; m: HM; onBack: () => void }) {
  return (
    <>
      <button type="button" onClick={onBack} className="-mt-1 flex h-9 cursor-pointer items-center gap-1 self-start border-0 bg-transparent p-0 text-xs text-white/80">
        <span aria-hidden="true">‹</span> {m.backToInfo}
      </button>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0" data-testid="area-story-shops">
        {item.offers.map((o) => (
          <OfferRow key={o.shopId} o={o} m={m} />
        ))}
      </ul>
    </>
  );
}

function OfferRow({ o, m }: { o: HighlightOffer; m: HM }) {
  const where = o.online ? m.online : o.address;
  const when = [o.hours, o.closed && m.closedOn(o.closed)].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white/[0.06] p-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{o.shopName}</span>
        {where && <span className="text-xs text-white/70">{where}</span>}
        {when && <span className="text-xs text-white/70">{when}</span>}
        {o.price != null && (
          <span className="text-xs text-white/85">
            {m.price(o.price)}
            {o.priceNote && ` · ${o.priceNote}`}
            {o.checkedAt && <span className="text-white/50">{` · ${m.checkedAt(o.checkedAt)}`}</span>}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {o.url && (
          <a
            href={o.url}
            target="_blank"
            rel="noopener"
            className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border border-white/30 text-[13px] font-semibold text-white no-underline"
          >
            {m.toShopSite} <span aria-hidden="true">↗</span>
          </a>
        )}
        <button type="button" disabled title={m.buyHereSoon} className="h-10 flex-1 rounded-xl border-0 text-[13px] font-semibold" style={{ background: "rgba(244,241,234,0.35)", color: "#141413" }}>
          {m.buyHere}
        </button>
      </div>
    </li>
  );
}
