"use client";

// shop-sheet：「探す」で出す、扱う店の一覧のシート。ストーリーの上に重ね、下に引くと閉じる（中身がいちばん上のときだけ）
import { useEffect, useRef } from "react";
import type { HighlightItem } from "@/lib/area-highlights";
import { Icon } from "../icons";
import { useSwipeDown } from "../use-swipe-down";
import { OfferRow } from "./OfferRow";
import type { HighlightMessages } from "./types";

type Props = { item: HighlightItem; m: HighlightMessages; closeLabel: string; onClose: () => void };

export function ShopSheet({ item, m, closeLabel, onClose }: Props) {
  const { style, attach } = useSwipeDown<HTMLElement>(onClose, { canStart: (el) => el.scrollTop <= 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  // 開いたら閉じるボタンにフォーカスを移す
  useEffect(() => closeRef.current?.focus(), []);
  return (
    <>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="absolute inset-0 z-[3] cursor-pointer border-0 bg-black/40" />
      <section
        ref={attach}
        aria-label={item.name}
        data-testid="area-story-peek"
        className="filter-mark-in absolute inset-x-0 bottom-0 z-[4] flex max-h-[85%] flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-3xl bg-[#1b1b19] px-5 pb-8 pt-2.5"
        style={style}
      >
        {/* 下に引いて閉じられることを示すつまみ */}
        <span aria-hidden="true" className="mx-auto block h-1 w-9 flex-none rounded-full bg-white/25" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] text-white/70">{m.shopsOf}</span>
            <p className="m-0 text-[20px] font-bold leading-snug">{item.name}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-2 flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-white"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="-mt-1 flex flex-wrap items-center gap-2">
          {item.season && <span className="rounded-md bg-white/[0.08] px-2 py-1 text-[11px]">{m.season(item.season.from, item.season.to)}</span>}
          <span className="text-xs text-white/75">{item.note}</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-5 p-0 pt-1" data-testid="area-story-shops">
          {item.offers.map((o) => (
            <OfferRow key={o.shopId} o={o} m={m} />
          ))}
        </ul>
      </section>
    </>
  );
}
