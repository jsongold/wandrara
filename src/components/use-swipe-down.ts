"use client";

// use-swipe-down：下に引いて閉じる。詳細ページ（DetailSheet）と同じ手ざわりにする
// - 指（マウスでも）に合わせて下げる。最初の動きが下向きの縦のときだけ引く（横・上はふつうの操作に任せる）
// - 遠くまで引いた・素早く払ったら、下へ滑らせてから閉じる（CLOSE_MS）。それ以外は元に戻す
// - 引いている間はブラウザのスクロール（iOS の弾み）を止める。React の touch は passive で止められないので、ブラウザのイベントで受ける
// - 引いた直後に指・マウスで起きた click だけを止める（引く操作がタップ扱いにならないように）。キーボードの click（detail = 0）は止めない
import { useEffect, useRef, useState } from "react";

// DetailSheet と同じ値
export const CLOSE_DISTANCE = 120; // これ以上引き下げたら閉じる（px）
const FLICK_SPEED = 0.6; // これより速く下へ払ったら、短くても閉じる（px/ms）
const FLICK_MIN = 30; // 払って閉じるときの最低の距離（px）
const FLICK_STALE_MS = 100; // 最後の動きからこれ以上止まっていたら、払ったとは見なさない（ms）
const LOCK_SLOP = 8; // 縦か横かを決めるまでの動き（px）
export const CLOSE_MS = 320; // 下へ滑らせる時間（globals.css の --sheet-close-ms）
export const SWIPE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SUPPRESS_MS = 400; // 引き終わってから click を止める時間（ms）

// 引き終わりで閉じるか。y：引いた距離、v：最後の速さ（px/ms）、idleMs：最後の動きからの時間
export function swipeDecision(y: number, v: number, idleMs: number): boolean {
  const flick = idleMs < FLICK_STALE_MS && v > FLICK_SPEED;
  return y > CLOSE_DISTANCE || (y > FLICK_MIN && flick);
}

type Options = {
  enabled?: boolean;
  // 引き始めてよいか（例：中身がいちばん上までスクロールされているときだけ）
  canStart?: (el: HTMLElement) => boolean;
};

type Drag = { x: number; y: number; axis: "y" | null; lastY: number; lastT: number; v: number };

export function useSwipeDown<T extends HTMLElement>(onClose: () => void, { enabled = true, canStart }: Options = {}) {
  const [el, setEl] = useState<T | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const latest = useRef({ onClose, enabled, canStart });
  useEffect(() => {
    latest.current = { onClose, enabled, canStart };
  });

  useEffect(() => {
    if (!el) return;
    let drag: Drag | null = null;
    let cur = 0;
    let suppressUntil = 0;
    let closingNow = false;
    let timer: number | undefined;
    const move = (v: number) => {
      cur = v;
      setDy(v);
    };
    const begin = (x: number, y: number, t: number) => {
      const o = latest.current;
      if (!o.enabled || closingNow) return;
      drag = { x, y, axis: null, lastY: y, lastT: t, v: 0 };
    };
    // 動き。true を返したら、この動きは引く操作（ブラウザの既定の動きを止める）
    const step = (x: number, y: number, t: number): boolean => {
      const d = drag;
      if (!d) return false;
      const dx = x - d.x;
      const dyNow = y - d.y;
      if (d.axis === null) {
        if (Math.hypot(dx, dyNow) < LOCK_SLOP) return false;
        const o = latest.current;
        if (Math.abs(dyNow) > Math.abs(dx) && dyNow > 0 && (!o.canStart || o.canStart(el))) {
          d.axis = "y";
          setDragging(true);
        } else {
          drag = null;
          return false;
        }
      }
      const dt = Math.max(1, t - d.lastT);
      d.v = (y - d.lastY) / dt;
      d.lastY = y;
      d.lastT = t;
      move(Math.max(0, dyNow));
      return true;
    };
    const release = () => {
      const d = drag;
      drag = null;
      setDragging(false);
      if (!d || d.axis !== "y") return;
      suppressUntil = Date.now() + SUPPRESS_MS;
      if (swipeDecision(cur, d.v, performance.now() - d.lastT)) {
        closingNow = true;
        setClosing(true);
        timer = window.setTimeout(() => {
          timer = undefined;
          closingNow = false;
          setClosing(false);
          move(0);
          latest.current.onClose();
        }, CLOSE_MS);
      } else {
        move(0);
      }
    };
    const cancel = () => {
      const d = drag;
      drag = null;
      if (d?.axis === "y") {
        setDragging(false);
        move(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return cancel();
      const t = e.touches[0];
      begin(t.clientX, t.clientY, e.timeStamp);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return cancel();
      const t = e.touches[0];
      if (step(t.clientX, t.clientY, e.timeStamp)) e.preventDefault();
    };
    // マウス・ペン：押して引く。指は touch の方で受ける
    // 離したのが要素の外でも受けられるよう、押している間は画面全体で「離した」を待つ
    const onWindowUp = (e: PointerEvent) => {
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      if (e.type === "pointercancel") cancel();
      else release();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      begin(e.clientX, e.clientY, e.timeStamp);
      window.addEventListener("pointerup", onWindowUp);
      window.addEventListener("pointercancel", onWindowUp);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !drag) return;
      if (step(e.clientX, e.clientY, e.timeStamp) && !el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
    };
    const onClick = (e: MouseEvent) => {
      if (e.detail > 0 && Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", release);
    // 中断（OS やブラウザが操作を取り上げた）は閉じずに元へ戻す
    el.addEventListener("touchcancel", cancel);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", release);
      el.removeEventListener("touchcancel", cancel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      // 閉じる途中で要素が消えたら（Esc で閉じた・別の候補へ移った）、待っている onClose を取り消して戻す
      if (timer !== undefined) window.clearTimeout(timer);
      setClosing(false);
      setDragging(false);
      setDy(0);
      el.removeEventListener("click", onClick, true);
    };
  }, [el]);

  // attach は要素に ref={attach} で付ける（callback ref）。style は引いている・閉じている間の動き
  const style = {
    transform: closing ? "translateY(100%)" : `translateY(${dy}px)`,
    transition: dragging ? "none" : `transform ${CLOSE_MS}ms ${SWIPE_EASE}`,
  };
  return { style, attach: setEl };
}
