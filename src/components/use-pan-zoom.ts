"use client";

// SVG の地図を指・マウスで動かす（ドラッグ）・寄せる（ピンチ・ホイール）。動かした直後のタップは選択にしない
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { clampView, panBy, parseView, toView, viewString, zoomAt, type View } from "@/lib/pan-zoom";

const DRAG_PX = 6; // これ以上動いたらタップではなくドラッグ

export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>, full: string | null, start: string | null) {
  // 動かした範囲は地図ごとに持つ。地図が変わったら、開いたときの範囲（start、無ければ全体）から
  const [moved, setMoved] = useState<{ key: string; view: View } | null>(null);
  const initial = full ? parseView(start ?? full) : null;
  const view = full && moved?.key === full ? moved.view : initial;
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const viewRef = useRef<View | null>(view);
  useEffect(() => {
    viewRef.current = view;
  });
  const dragged = useRef(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !full) return;
    const fullView = parseView(full);
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);

    const pts = new Map<number, { x: number; y: number }>();
    let distance = 0;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };
    const first = parseView(start ?? full);
    const apply = (f: (v: View) => View) => setMoved((m) => ({ key: full, view: f(m?.key === full ? m.view : first) }));

    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        distance = 0;
        dragged.current = false;
      }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev || !viewRef.current) return;
      const l = local(e);
      const { unit } = toView(viewRef.current, l, 0, 0);
      if (pts.size === 1) {
        distance += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
        if (distance > DRAG_PX) dragged.current = true;
        apply((v) => panBy(v, (e.clientX - prev.x) * unit, (e.clientY - prev.y) * unit, fullView));
      } else if (pts.size === 2) {
        const other = [...pts.entries()].find(([id]) => id !== e.pointerId)?.[1];
        if (other) {
          const before = Math.hypot(prev.x - other.x, prev.y - other.y);
          const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
          const mid = local({ clientX: (e.clientX + other.x) / 2, clientY: (e.clientY + other.y) / 2 });
          dragged.current = true;
          if (before > 0) apply((v) => { const p = toView(v, mid, mid.x, mid.y); return zoomAt(v, p.x, p.y, after / before, fullView); });
        }
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => pts.delete(e.pointerId);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const l = local(e);
      apply((v) => { const p = toView(v, l, l.x, l.y); return zoomAt(v, p.x, p.y, Math.exp(-e.deltaY / 300), fullView); });
    };
    // 動かした直後のクリックは、エリアの選択にしない
    const click = (e: MouseEvent) => {
      if (dragged.current) {
        e.stopPropagation();
        e.preventDefault();
        dragged.current = false;
      }
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("click", click, true);
    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("click", click, true);
    };
  }, [svgRef, full, start]);

  // 表示範囲を外から決める（押したエリアへ寄るときなど）
  const setView = useCallback((v: View) => {
    if (full) setMoved({ key: full, view: clampView(v, parseView(full)) });
  }, [full]);

  // 文字と点が、寄せても同じ px に見えるようにする倍率（viewBox の 1px あたりの単位）
  const unit = view && box && box.w > 0 && box.h > 0 ? Math.max(view.w / box.w, view.h / box.h) : 1;
  return { viewBox: view ? viewString(view) : (full ?? undefined), unit, view, box, setView };
}
