"use client";

// use-swipe-down：下へのスワイプで閉じる。指に合わせて下げ（dy）、しきい値を超えるか素早く払って離したら onClose
// - 縦より横に動いたとき・上へ動いたときは何もしない（中身のスクロールはそのまま）
// - 下に引いている間は、ブラウザ本来のスクロール（iOS の弾み）を止める。React の touch は passive で止められないので、ブラウザのイベントで受ける
// - スワイプの直後に指で起きた click だけを止める（スワイプがタップ扱いにならないように）。キーボードの click（detail = 0）は止めない
import { useEffect, useRef, useState } from "react";

type Options = {
  enabled?: boolean;
  threshold?: number;
  // 指を置いた時点で始めてよいか（例：中身が上までスクロールされているときだけ）
  canStart?: (el: HTMLElement) => boolean;
};

export function swipeDecision(dy: number, ms: number, threshold: number): boolean {
  return dy > threshold || (dy > 40 && ms < 250);
}

// 指を離してから、指による click を止める時間（ms）
const SUPPRESS_MS = 400;

export function useSwipeDown<T extends HTMLElement>(onClose: () => void, { enabled = true, threshold = 90, canStart }: Options = {}) {
  const [el, setEl] = useState<T | null>(null);
  const [dy, setDy] = useState(0);
  const latest = useRef({ onClose, enabled, threshold, canStart });
  useEffect(() => {
    latest.current = { onClose, enabled, threshold, canStart };
  });

  useEffect(() => {
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    let cur = 0;
    let moved = false;
    let suppressUntil = 0;
    const set = (v: number) => {
      cur = v;
      setDy(v);
    };
    const onStart = (e: TouchEvent) => {
      const o = latest.current;
      moved = false;
      if (!o.enabled || e.touches.length !== 1 || (o.canStart && !o.canStart(el))) {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: Date.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1) {
        start = null;
        set(0);
        return;
      }
      const t = e.touches[0];
      const d = t.clientY - start.y;
      const dx = t.clientX - start.x;
      if (Math.abs(d) > 8 || Math.abs(dx) > 8) moved = true;
      if (d > 0 && Math.abs(d) > Math.abs(dx)) {
        e.preventDefault();
        set(d);
      } else if (cur !== 0) {
        set(0);
      }
    };
    const onEnd = () => {
      const s = start;
      const d = cur;
      start = null;
      set(0);
      if (moved) suppressUntil = Date.now() + SUPPRESS_MS;
      if (s && swipeDecision(d, Date.now() - s.t, latest.current.threshold)) latest.current.onClose();
    };
    const onCancel = () => {
      start = null;
      set(0);
    };
    const onClick = (e: MouseEvent) => {
      if (e.detail > 0 && Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      el.removeEventListener("click", onClick, true);
    };
  }, [el]);

  // attach は要素に ref={...attach} で付ける（callback ref）
  return { dy, attach: setEl };
}
