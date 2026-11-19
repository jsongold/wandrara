"use client";

// story-view：全画面のストーリー 1 枚。上に進み具合と項目名、左右のタップで前後、下に名前・一言・写真の権利・「探す」
// 下に引くと閉じる（シートを開いていないとき）。シートを開いている間は、ストーリーの操作を inert にする
import type { RefObject } from "react";
import type { HighlightGroup, HighlightItem } from "@/lib/area-highlights";
import { Icon } from "../icons";
import { useSwipeDown } from "../use-swipe-down";
import { colorFill, ItemPhoto, PhotoCredit } from "./ItemPhoto";
import { ShopSheet } from "./ShopSheet";
import type { StoryPos } from "./story-nav";
import type { HighlightMessages } from "./types";

type Props = {
  group: HighlightGroup;
  item: HighlightItem;
  pos: StoryPos;
  areaLabel: string;
  m: HighlightMessages;
  closeLabel: string;
  sheetOpen: boolean;
  findRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFind: () => void;
  onCloseSheet: () => void;
};

export function StoryView({ group, item, pos, areaLabel, m, closeLabel, sheetOpen, findRef, onClose, onPrev, onNext, onFind, onCloseSheet }: Props) {
  // resetKey：閉じる途中で次の候補へ移ったら、その閉じる動きを取り消す（ボタンは作り直さないのでフォーカスは残る）
  const { style, attach } = useSwipeDown<HTMLDivElement>(onClose, { enabled: !sheetOpen, resetKey: `${pos.g}-${pos.i}` });
  return (
    <div ref={attach} data-testid="area-story" className="relative flex h-full flex-col text-white" style={{ ...colorFill(item.color), ...style }}>
      {item.photo && <ItemPhoto item={item} className="absolute inset-0 h-full w-full" />}
      <div className="contents" inert={sheetOpen}>
        <div className="relative z-[2] flex gap-1 px-3 pt-3" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))" }}>
          {group.items.map((_, i) => (
            <span key={i} className="h-[3px] flex-1 rounded-full" style={{ background: i <= pos.i ? "#ffffff" : "rgba(255,255,255,0.35)" }} />
          ))}
        </div>
        <div className="relative z-[2] flex items-center justify-between px-4 pt-2">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{m.kind[group.kind]}</span>
            <span className="text-[11px] text-white/80">{m.position(areaLabel, pos.i + 1, group.items.length)}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-white">
            <Icon name="close" />
          </button>
        </div>

        {/* 左 35% で前、残りで次 */}
        <button type="button" aria-label={m.prev} onClick={onPrev} className="absolute bottom-[180px] left-0 top-[80px] z-[1] w-[35%] cursor-pointer border-0 bg-transparent" />
        <button type="button" aria-label={m.next} onClick={onNext} className="absolute bottom-[180px] right-0 top-[80px] z-[1] w-[65%] cursor-pointer border-0 bg-transparent" />

        <div className="relative z-[2] mt-auto flex flex-col gap-2 px-5 pb-10" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.55) 30%)" }}>
          <p className="m-0 pt-8 text-[28px] font-bold leading-tight">{item.name}</p>
          <p className="m-0 text-sm text-white/90">{item.note}</p>
          {item.photo && <PhotoCredit photo={item.photo} m={m} />}
          {item.offers.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <button
                ref={findRef}
                type="button"
                onClick={onFind}
                aria-expanded={sheetOpen}
                aria-label={m.findWithCount(item.offers.length)}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border-0 px-4 text-sm font-semibold"
                style={{ background: "#f4f1ea", color: "#141413" }}
              >
                {m.find}
                <span aria-hidden="true" className="text-xs font-normal text-[#141413]/70">{m.shopCount(item.offers.length)}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {sheetOpen && <ShopSheet item={item} m={m} closeLabel={closeLabel} onClose={onCloseSheet} />}
    </div>
  );
}
