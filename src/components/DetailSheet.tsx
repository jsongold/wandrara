"use client";

// 詳細を下からスライドさせて全画面で出す。裏のフィードは動かさない。
// 閉じる：上端のバーの閉じるボタン・Esc・下に引く（本文がいちばん上のとき、画面のどこからでも）・ブラウザの戻る。
// 上端のバーは常に出ていて、写真を過ぎたら背景と名前が出る（名前と保存は DestDetail が SheetBarContent で差し込む）。
// 上がる動きは CSS（globals.css の .sheet-panel）。閉じるときは下へ滑らせてから戻る（router.back）。
// ブラウザの戻る（iOS の戻るスワイプなど）で閉じたときは、ブラウザ側の動きに任せる。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMessages } from "@/lib/i18n/use-locale";
import { Icon } from "./icons";
import { SheetBarContext, SheetCloseContext } from "./sheet-context";
import { useSwipeDown } from "./use-swipe-down";

const SOLID_AT = 340; // ここまでスクロールしたらバーに背景を付ける（写真 420px の下の方）

export const SHEET_GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};


export function DetailSheet({ children, label }: { children: ReactNode; label?: string }) {
  const router = useRouter();
  const m = useMessages();
  const [solid, setSolid] = useState(false);
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // 下に引いて閉じる（use-swipe-down）。本文がいちばん上のときだけ、画面のどこからでも引ける。マウスは上端のバーの空いているところ（名前の上も）から。
  // 閉じるボタン・Esc も同じく下へ滑らせてから戻る（router.back）
  const { style: swipeStyle, attach: attachPanel, closing, dismiss: close } = useSwipeDown<HTMLDivElement>(() => router.back(), {
    canStart: () => (scroller.current?.scrollTop ?? 0) <= 0,
    mouseFilter: (t) => !!t.closest(".sheet-bar") && !t.closest("button"),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // 開いたら閉じるボタンにフォーカスを移し、裏のトップを操作できなくする（inert）。
  // 閉じたら（隠れる・消える）、開く前にフォーカスがあったところ（押したカード）に戻す
  useEffect(() => {
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const home = document.querySelector<HTMLElement>("[data-home]");
    home?.setAttribute("inert", "");
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      home?.removeAttribute("inert");
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, []);

  // 開いている合図（DebugOverlay が読む）。表示している間だけ付ける
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sheet = closing ? "closing" : "open";
    return () => { delete root.dataset.sheet; };
  }, [closing]);

  // cacheComponents では閉じたシートが消えずに隠れて残り、同じスポットを開くとそのまま出てくる。
  // 隠れるときに本文の位置と背景を戻す（引く・閉じる途中の状態は use-swipe-down が要素の付け外しで戻す）
  useEffect(() => () => {
    setSolid(false);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, []);

  return (
    <div data-sheet={closing ? "closing" : "open"} className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label ?? m.detail.sheetLabel}>
      <div
        ref={attachPanel}
        className="sheet-panel relative flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[#f7f6f2]"
        style={swipeStyle}
      >
        {/* 上端のバー：閉じるボタンは常に見える。写真を過ぎたら背景と名前が出る */}
        <div
          data-solid={solid}
          className="sheet-bar group absolute inset-x-0 top-0 z-20 flex cursor-grab items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] transition-[background-color,box-shadow] duration-200 data-[solid=true]:bg-[#f7f6f2] data-[solid=true]:shadow-[0_1px_0_rgba(20,20,19,0.08)]"
        >
          <button
            type="button"
            ref={closeButton}
            onClick={close}
            aria-label={m.common.close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
            style={SHEET_GLASS}
          >
            <Icon name="close" />
          </button>
          <div ref={setBarSlot} className="pointer-events-none flex min-w-0 flex-1 items-center gap-3 [&>*]:pointer-events-auto" />
        </div>
        <div
          ref={scroller}
          onScroll={(e) => setSolid(e.currentTarget.scrollTop > SOLID_AT)}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <SheetCloseContext value={close}>
            <SheetBarContext value={barSlot}>{children}</SheetBarContext>
          </SheetCloseContext>
        </div>
      </div>
    </div>
  );
}
