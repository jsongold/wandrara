"use client";

// 写真を横にスワイプして 1 枚ずつ切り替える（CSS の scroll-snap）。トップのカードと詳細で使う。
// href があれば写真の枠ごと 1 本のリンクになる（スワイプはスクロール、タップは遷移）。
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMessages } from "@/lib/i18n/use-locale";
import { imageQuality } from "@/lib/save-data";
import { useHydrated, useSaveData, useSaveDataHint } from "@/lib/use-save-data";
import type { Photo } from "@/lib/types";
import { Icon } from "./icons";

function placeholder(photo: Photo | null): CSSProperties {
  const sky = photo?.placeholderSky ?? "#8f9692";
  const land = photo?.placeholderLand ?? "#2e322f";
  return { background: `linear-gradient(180deg, ${sky} 0%, ${sky} 56%, ${land} 56%, ${land} 100%)` };
}

// near：今の写真と前後 1 枚。それ以外は <img> を作らない（画像の展開でメモリを使い切らないため）
function Slide({ photo, index, eager, near, quality }: { photo: Photo | null; index: number; eager: boolean; near: boolean; quality: number }) {
  if (photo?.url && !photo.isDemo && near) {
    return (
      // 列は最大 480px 幅（HomeScreen の max-w-[480px]）。sizes を付けると、PC の広い窓でも 1080 を取らず幅に合う大きさだけ取る（next.config.ts の images）
      <Image
        src={photo.url}
        alt=""
        fill
        sizes="(max-width: 480px) 100vw, 480px"
        quality={quality}
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        data-index={index}
        className="select-none object-cover"
      />
    );
  }
  return <span className="block h-full w-full" style={placeholder(photo)} />;
}

type Props = {
  photos: Photo[];
  href?: string;
  // href は詳細（/d/[slug]）へのリンク。prefetch={true} で詳細の中身（slug ごとの use cache）まで先に読み、押したら待たずに出す
  label: string; // 写真の説明（スクリーンリーダー向け）
  counterClassName?: string;
  className?: string;
  children?: ReactNode; // 写真の上に重ねるもの（タイトルなど。操作を邪魔しないよう pointer-events-none にする）
  priority?: boolean; // 1 枚目を先に読む（画面の最初に見える写真だけ true にする）
};

export function PhotoCarousel({ photos, href, label, counterClassName = "bottom-4 right-4", className = "", children, priority = true }: Props) {
  const slides: (Photo | null)[] = photos.length > 0 ? photos : [null];
  const m = useMessages();
  // 通信量を抑える（Save-Data）：詳細の先読みと、今の写真の前後 1 枚の先読みをしない（今の写真だけ。スワイプで止まったら読む）。画質も下げる
  const saveData = useSaveData();
  const hint = useSaveDataHint(); // 画質はサーバーの HTML と揃える（詳細のようにサーバーが Save-Data を知らないページでは下げない）
  // 前後 1 枚は水和のあとに出す（サーバーの HTML に入れると、Save-Data かどうかが分かる前にブラウザが取ってしまう）
  const hydrated = useHydrated();
  const reach = saveData || !hydrated ? 0 : 1;
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // スワイプ（指が動いた・ブラウザがスクロールに切り替えた）の後はタップとして扱わない
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  function onScroll() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(slides.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }
  function go(delta: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: (index + delta) * el.clientWidth, behavior: "smooth" });
  }

  const track = (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {slides.map((p, i) => (
        <div key={i} className="relative h-full w-full shrink-0 snap-center snap-always" aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}>
          <Slide photo={p} index={i} eager={priority && i === 0} near={Math.abs(i - index) <= reach} quality={imageQuality(hint)} />
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerDown={(e) => { pointerStart.current = { x: e.clientX, y: e.clientY }; swiped.current = false; }}
      onPointerMove={(e) => {
        const s = pointerStart.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) swiped.current = true;
      }}
      onPointerCancel={() => { swiped.current = true; }}
      onClickCapture={(e) => {
        // detail === 0 はキーボード由来のクリック。ポインターのスワイプの残りで止めない（保存ボタンを Enter/Space で押せるように）
        if (!swiped.current || e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {href ? (
        // 写真ごとに Link を作らず、スクロールの枠ごと 1 本の Link で包む（カードごとの Link を写真の枚数分から 1 本にする）
        <Link href={href} prefetch={!saveData} aria-label={m.photos.open(label)} className="block h-full w-full" draggable={false}>
          {track}
        </Link>
      ) : (
        track
      )}

      {children}

      {slides.length > 1 && (
        <>
          <span className={`pointer-events-none absolute rounded-xl bg-[rgba(15,15,14,0.6)] px-2.5 py-1 text-xs font-semibold text-white ${counterClassName}`} aria-live="polite">
            {index + 1} / {slides.length}
          </span>
          {/* マウスの環境だけ前後ボタンを出す（タッチはスワイプ） */}
          {index > 0 && (
            <button type="button" onClick={() => go(-1)} aria-label={m.photos.prev} className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white [@media(hover:hover)]:flex">
              <Icon name="back" size={18} />
            </button>
          )}
          {index < slides.length - 1 && (
            <button type="button" onClick={() => go(1)} aria-label={m.photos.next} className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 rotate-180 items-center justify-center rounded-full bg-black/45 text-white [@media(hover:hover)]:flex">
              <Icon name="back" size={18} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
