"use client";

// 詳細を下からスライドさせて出すシート。ハンドルを下に引く・背景を押す・Esc で閉じる（router.back）。
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

const CLOSE_DISTANCE = 120; // これ以上引き下げたら閉じる（px）
const CLOSE_MS = 220;

export function DetailSheet({ children }: { children: ReactNode }) {
  const router = useRouter();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="スポットの詳細">
      <button
        type="button"
        aria-label="閉じる"
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${closing ? "opacity-0" : "animate-[sheet-fade_200ms_ease-out]"}`}
      />
      <div
        className="relative flex h-[94dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-[#f7f6f2] shadow-2xl motion-safe:animate-[sheet-up_300ms_cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          transform: closing ? "translateY(100%)" : `translateY(${dragY}px)`,
          transition: dragging ? "none" : `transform ${CLOSE_MS}ms ease-out`,
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
