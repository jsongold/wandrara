"use client";

// area-stories：エリアの一言の全画面のストーリー。フィードのカルーセルの 1 枚（StoriesTile）から開き、候補を順に見せる。
// 開いている間だけ置く（呼ぶ側が開くときに置き、onClose で外す）。モーダルの <dialog>（後ろの画面にフォーカスが行かない）。外したら returnFocus に戻す
// 「探す」で扱う店の一覧のシートを重ねる。部品：StoryView（ストーリー 1 枚）・ShopSheet（扱う店の一覧）・OfferRow（店の 1 行）
import { useEffect, useRef, useState } from "react";
import type { HighlightGroup } from "@/lib/area-highlights";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { markSeen } from "./seen-store";
import { nextPos, prevPos, type StoryPos } from "./story-nav";
import { StoryView } from "./StoryView";

type Props = { locale: Locale; area: string; areaLabel: string; groups: HighlightGroup[]; returnFocus: HTMLElement | null; onClose: () => void };

export function AreaStories({ locale, area, areaLabel, groups, returnFocus, onClose }: Props) {
  const m = messages(locale).highlights;
  const closeLabel = messages(locale).common.close;
  const [pos, setPos] = useState<StoryPos>({ g: 0, i: 0 });
  const [sheetOpen, setSheet] = useState(false);

  // 開いた項目を「見た」にする
  useEffect(() => {
    if (groups[pos.g]) markSeen(area, groups[pos.g].kind);
  }, [area, groups, pos.g]);

  const go = (next: StoryPos | null) => {
    if (!next) return onClose();
    setPos(next);
    setSheet(false);
  };

  // シートを閉じたら「探す」にフォーカスを戻す（inert が外れてから）
  const findRef = useRef<HTMLButtonElement>(null);
  const wasSheet = useRef(false);
  useEffect(() => {
    if (!sheetOpen && wasSheet.current) findRef.current?.focus();
    wasSheet.current = sheetOpen;
  }, [sheetOpen]);

  // 置かれたら開き、外されたら閉じて、押した 1 枚にフォーカスを戻す
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnRef = useRef(returnFocus);
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    const back = returnRef.current;
    return () => {
      if (d?.open) d.close();
      back?.focus();
    };
  }, []);

  // ← → で前後（シートを開いていないとき）
  useEffect(() => {
    if (sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(nextPos(groups, pos));
      if (e.key === "ArrowLeft") go(prevPos(groups, pos));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const group = groups[pos.g];
  const item = group?.items[pos.i];

  return (
    // Esc はブラウザの cancel で受け、シートを先に閉じる。dialog は top layer に出るので、アプリの幅（480px）に合わせて置く
    <dialog
      ref={dialogRef}
      aria-label={group ? m.kind[group.kind] : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (sheetOpen) setSheet(false);
        else onClose();
      }}
      className="m-0 mx-auto h-[100dvh] max-h-none w-full max-w-[480px] border-0 bg-transparent p-0 text-white backdrop:bg-black/60"
    >
      {group && item && (
        <StoryView
          group={group}
          item={item}
          pos={pos}
          areaLabel={areaLabel}
          m={m}
          closeLabel={closeLabel}
          sheetOpen={sheetOpen}
          findRef={findRef}
          onClose={onClose}
          onPrev={() => go(prevPos(groups, pos))}
          onNext={() => go(nextPos(groups, pos))}
          onFind={() => setSheet(true)}
          onCloseSheet={() => setSheet(false)}
        />
      )}
    </dialog>
  );
}
