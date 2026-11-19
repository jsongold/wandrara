"use client";

// use-swipe-up：上に払って閉じる（ヘッダーから下に開くポップアップ用）
// - 指・マウスに合わせて上へ動かす。最初の動きが上向きの縦のときだけ（横の動きはタイルの列のスクロールに任せる）
// - 48px 以上上げた・素早く払ったら閉じる。それ以外は元に戻す
// - 引いた直後の click は止める（タイルを開かない）
import { useEffect, useState } from "react";

const LOCK_SLOP = 8; // 縦か横かを決めるまでの動き（px）
const CLOSE_DISTANCE = 48; // これ以上上げたら閉じる（px）
const FLICK_SPEED = 0.5; // これより速く上へ払ったら、短くても閉じる（px/ms）
const SUPPRESS_MS = 400; // 引き終わってから click を止める時間（ms）

export function useSwipeUp<T extends HTMLElement>(onClose: () => void, enabled: boolean) {
  const [el, setEl] = useState<T | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!el || !enabled) return;
    let start: { x: number; y: number; id: number; axis: "y" | null; lastY: number; lastT: number; v: number } | null = null;
    let cur = 0;
    let suppressUntil = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    };
    const move = (e: PointerEvent) => {
      const s = start;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const d = e.clientY - s.y;
      if (s.axis === null) {
        if (Math.hypot(dx, d) < LOCK_SLOP) return;
        if (Math.abs(d) > Math.abs(dx) && d < 0) {
          s.axis = "y";
          setDragging(true);
          el.setPointerCapture(e.pointerId);
        } else {
          start = null;
          return;
        }
      }
      s.v = (e.clientY - s.lastY) / Math.max(1, e.timeStamp - s.lastT);
      s.lastY = e.clientY;
      s.lastT = e.timeStamp;
      cur = Math.min(0, d);
      setDy(cur);
    };
    const up = (e: PointerEvent) => {
      const s = start;
      start = null;
      if (!s || s.axis !== "y") return;
      setDragging(false);
      suppressUntil = Date.now() + SUPPRESS_MS;
      const flick = e.timeStamp - s.lastT < 100 && s.v < -FLICK_SPEED;
      if (e.type !== "pointercancel" && (cur < -CLOSE_DISTANCE || (cur < -16 && flick))) onClose();
      cur = 0;
      setDy(0);
    };
    const click = (e: MouseEvent) => {
      if (e.detail > 0 && Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
      setDragging(false);
      setDy(0);
    };
  }, [el, enabled, onClose]);

  return { attach: setEl, dy, dragging };
}
