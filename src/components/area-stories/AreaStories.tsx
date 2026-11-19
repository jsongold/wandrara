"use client";

// area-stories：エリアの一言。エリアに絞り込んだときだけ、ヘッダーの下に項目のタイルを出し、押すと全画面のストーリーで候補を順に見せる。
// 「探す」で扱う店の一覧のシートを重ねる。ストーリーはモーダルの <dialog>（後ろの画面にフォーカスが行かない。閉じたら押したタイルに戻る）
// 部品：StoryTiles（タイル）・StoryView（ストーリー 1 枚）・ShopSheet（扱う店の一覧）・OfferRow（店の 1 行）
import { useEffect, useRef, useState } from "react";
import type { HighlightGroup } from "@/lib/area-highlights";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { markSeen, useSeen } from "./seen-store";
import { nextPos, prevPos, type StoryPos } from "./story-nav";
import { StoryTiles } from "./StoryTiles";
import { StoryView } from "./StoryView";

type Props = { locale: Locale; area: string; areaLabel: string; groups: HighlightGroup[] };
type OpenState = { area: string; pos: StoryPos; sheet: boolean };

export function AreaStories({ locale, area, areaLabel, groups }: Props) {
  const m = messages(locale).highlights;
  const closeLabel = messages(locale).common.close;
  const seen = useSeen(area);
  const [state, setState] = useState<OpenState | null>(null);
  // エリアが変わったら閉じる
  const open = state?.area === area ? state.pos : null;
  const sheetOpen = open !== null && state?.sheet === true;

  const setOpen = (next: StoryPos | null) => {
    // 開いた項目を「見た」にする
    if (next && groups[next.g]) markSeen(area, groups[next.g].kind);
    setState(next ? { area, pos: next, sheet: false } : null);
  };
  const setSheet = (v: boolean) => setState((s) => (s ? { ...s, sheet: v } : s));

  // シートを閉じたら「探す」にフォーカスを戻す（inert が外れてから）
  const findRef = useRef<HTMLButtonElement>(null);
  const wasSheet = useRef(false);
  useEffect(() => {
    if (!sheetOpen && wasSheet.current) findRef.current?.focus();
    wasSheet.current = sheetOpen;
  }, [sheetOpen]);

  // dialog の開け閉め。閉じたら押したタイルにフォーカスを戻す
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

  // ← → で前後（シートを開いていないとき）
  useEffect(() => {
    if (!open || sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen(nextPos(groups, open));
      if (e.key === "ArrowLeft") setOpen(prevPos(groups, open));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (groups.length === 0) return null;
  const group = open ? groups[open.g] : null;
  const item = open && group ? group.items[open.i] : null;

  return (
    <>
      <StoryTiles
        groups={groups}
        seen={seen}
        label={m.label(areaLabel)}
        m={m}
        onOpen={(g, trigger) => {
          triggerRef.current = trigger;
          setOpen({ g, i: 0 });
        }}
      />
      {/* Esc はブラウザの cancel で受け、シートを先に閉じる。dialog は top layer に出るので、アプリの幅（480px）に合わせて置く */}
      <dialog
        ref={dialogRef}
        aria-label={group ? m.kind[group.kind] : undefined}
        onCancel={(e) => {
          e.preventDefault();
          if (sheetOpen) setSheet(false);
          else setOpen(null);
        }}
        className="m-0 mx-auto h-[100dvh] max-h-none w-full max-w-[480px] border-0 bg-transparent p-0 text-white backdrop:bg-black/60"
      >
        {open && group && item && (
          // 候補ごとに作り直す（閉じる途中の引く動きや待ちを、次の候補に持ち越さない）
          <StoryView
            key={`${open.g}-${open.i}`}
            group={group}
            item={item}
            pos={open}
            areaLabel={areaLabel}
            m={m}
            closeLabel={closeLabel}
            sheetOpen={sheetOpen}
            findRef={findRef}
            onClose={() => setOpen(null)}
            onPrev={() => setOpen(prevPos(groups, open))}
            onNext={() => setOpen(nextPos(groups, open))}
            onFind={() => setSheet(true)}
            onCloseSheet={() => setSheet(false)}
          />
        )}
      </dialog>
    </>
  );
}
