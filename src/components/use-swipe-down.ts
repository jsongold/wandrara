"use client";

// use-swipe-down：下へのスワイプで閉じる。指に合わせて下げ（dy）、しきい値を超えるか素早く払って離したら onClose
// 縦より横に動いたとき・上へ動いたときは何もしない。動かした後の click は止める（スワイプがタップ扱いにならないように）
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";

type Options = {
  enabled?: boolean;
  threshold?: number;
  // 指を置いた時点で始めてよいか（例：中身が上までスクロールされているときだけ）
  canStart?: (el: HTMLElement) => boolean;
};

export function swipeDecision(dy: number, ms: number, threshold: number): boolean {
  return dy > threshold || (dy > 40 && ms < 250);
}

export function useSwipeDown(onClose: () => void, { enabled = true, threshold = 90, canStart }: Options = {}) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const dyRef = useRef(0);
  const moved = useRef(false);
  const [dy, setDy] = useState(0);

  const set = (v: number) => {
    dyRef.current = v;
    setDy(v);
  };
  const reset = () => {
    start.current = null;
    set(0);
  };

  return {
    dy,
    handlers: {
      onTouchStart(e: TouchEvent<HTMLElement>) {
        moved.current = false;
        if (!enabled || e.touches.length !== 1 || (canStart && !canStart(e.currentTarget))) {
          start.current = null;
          return;
        }
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      },
      onTouchMove(e: TouchEvent<HTMLElement>) {
        const s = start.current;
        if (!s) return;
        if (e.touches.length !== 1) return reset();
        const t = e.touches[0];
        const d = t.clientY - s.y;
        const dx = t.clientX - s.x;
        if (Math.abs(d) > 8 || Math.abs(dx) > 8) moved.current = true;
        set(d > 0 && Math.abs(d) > Math.abs(dx) ? d : 0);
      },
      onTouchEnd() {
        const s = start.current;
        const d = dyRef.current;
        reset();
        if (s && swipeDecision(d, Date.now() - s.t, threshold)) onClose();
      },
      onTouchCancel: reset,
      onClickCapture(e: MouseEvent<HTMLElement>) {
        if (!moved.current) return;
        moved.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}
