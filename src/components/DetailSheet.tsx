"use client";

// 詳細を下からスライドさせて出すシート。ハンドルを下に引く・背景を押す・Esc・閉じるで閉じる（router.back）。
// 上がる動きは CSS（globals.css の .sheet-panel）。閉じるときは下へ滑らせてから戻る。
// ブラウザの戻る（iOS の戻るスワイプなど）で閉じたときは、ブラウザ側の動きに任せる。
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useMessages } from "@/lib/i18n/use-locale";
import { SheetCloseContext } from "./sheet-context";

const CLOSE_DISTANCE = 120; // これ以上引き下げたら閉じる（px）
const CLOSE_MS = 320; // globals.css の --sheet-close-ms と合わせる

export function DetailSheet({ children }: { children: ReactNode }) {
  const router = useRouter();
  const m = useMessages();
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => router.back(), CLOSE_MS);
  }, [closing, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // 裏のトップを縮める合図（globals.css の html[data-sheet]）。表示している間だけ付ける
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sheet = closing ? "closing" : "open";
    return () => { delete root.dataset.sheet; };
  }, [closing]);

  // cacheComponents では閉じたシートが消えずに隠れて残り、同じスポットを開くとそのまま出てくる。
  // 隠れるときに「閉じている途中」を戻しておかないと、透明な背景が画面を覆ってトップを押せなくなる。
  useEffect(() => () => {
    setClosing(false);
    setDragY(0);
    setDragging(false);
    start.current = null;
  }, []);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    start.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (start.current === null) return;
    setDragY(Math.max(0, e.clientY - start.current));
  }
  function onPointerUp() {
    if (start.current === null) return;
    start.current = null;
    setDragging(false);
    if (dragY > CLOSE_DISTANCE) close();
    else setDragY(0);
  }

  return (
    <div data-sheet={closing ? "closing" : "open"} className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={m.detail.sheetLabel}>
      <button
        type="button"
        aria-label={m.common.close}
        onClick={close}
        className={`sheet-backdrop absolute inset-0 touch-none bg-black/50 transition-opacity duration-300 ${closing ? "opacity-0" : ""}`}
      />
      <div
        className="sheet-panel relative flex h-[94dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-[#f7f6f2] shadow-2xl"
        style={{
          transform: closing ? "translateY(100%)" : `translateY(${dragY}px)`,
          transition: dragging ? "none" : `transform ${CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-x-0 top-0 z-10 flex h-7 cursor-grab touch-none justify-center pt-2.5"
          aria-hidden="true"
        >
          <span className="h-1.5 w-11 rounded-full bg-white/80 shadow" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SheetCloseContext value={close}>{children}</SheetCloseContext>
        </div>
      </div>
    </div>
  );
}
