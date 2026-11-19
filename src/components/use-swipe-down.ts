"use client";

// use-swipe-down：下に引いて閉じる。詳細ページ（DetailSheet）・エリアの一言のストーリーと一覧のシートで共通に使う
// - 指（マウスでも）に合わせて下げる。最初の動きが下向きの縦のときだけ引く（横・上はふつうの操作に任せる）
// - 遠くまで引いた・素早く払ったら、下へ滑らせてから閉じる（CLOSE_MS）。それ以外は元に戻す
// - 引いている間はブラウザのスクロール（iOS の弾み）を止める。React の touch は passive で止められないので、ブラウザのイベントで受ける
// - 引いた直後に指・マウスで起きた click だけを止める（引く操作がタップ扱いにならないように）。キーボードの click（detail = 0）は止めない
// - dismiss()：閉じるボタン・Esc から、同じく下へ滑らせて閉じる
import { useCallback, useEffect, useRef, useState } from "react";

export const CLOSE_DISTANCE = 120; // これ以上引き下げたら閉じる（px）
const FLICK_SPEED = 0.6; // これより速く下へ払ったら、短くても閉じる（px/ms）
const FLICK_MIN = 30; // 払って閉じるときの最低の距離（px）
const FLICK_STALE_MS = 100; // 最後の動きからこれ以上止まっていたら、払ったとは見なさない（ms）
const LOCK_SLOP = 8; // 縦か横かを決めるまでの動き（px）
export const CLOSE_MS = 320; // 下へ滑らせる時間（globals.css の --sheet-close-ms と合わせる）
export const SWIPE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const SUPPRESS_MS = 400; // 引き終わってから click を止める時間（ms）

// 引き終わりで閉じるか。y：引いた距離、v：最後の速さ（px/ms）、idleMs：最後の動きからの時間
export function swipeDecision(y: number, v: number, idleMs: number): boolean {
  const flick = idleMs < FLICK_STALE_MS && v > FLICK_SPEED;
  return y > CLOSE_DISTANCE || (y > FLICK_MIN && flick);
}

type Options = {
  enabled?: boolean;
  // 引き始めてよいか（例：中身がいちばん上までスクロールされているときだけ）。縦か横かを決めたときに見る
  canStart?: (el: HTMLElement) => boolean;
  // マウス・ペンで引き始めてよい場所（例：上端のバーだけ）。省略すると要素のどこからでも
  mouseFilter?: (target: Element) => boolean;
  // 中身が替わったことを表す値（例：ストーリーの位置）。閉じる途中で替わったら、その閉じる動きと onClose を取り消す
  resetKey?: unknown;
};

type Drag = { x: number; y: number; axis: "y" | null; lastY: number; lastT: number; v: number };

export function useSwipeDown<T extends HTMLElement>(onClose: () => void, { enabled = true, canStart, mouseFilter, resetKey }: Options = {}) {
  const [el, setEl] = useState<T | null>(null);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  // 閉じる動きを始めたときの resetKey（{ key } で包む。null は閉じていない）。中身が替わったら閉じる動きは無効になる
  const [closingFor, setClosingFor] = useState<{ key: unknown } | null>(null);
  const closing = closingFor !== null && Object.is(closingFor.key, resetKey);
  const latest = useRef({ onClose, enabled, canStart, mouseFilter, resetKey });
  useEffect(() => {
    latest.current = { onClose, enabled, canStart, mouseFilter, resetKey };
  });
  const timer = useRef<number | undefined>(undefined);
  const closingNow = useRef(false);

  // 下へ滑らせてから閉じる。閉じる途中で中身が替わっていたら onClose は呼ばない
  const dismiss = useCallback(() => {
    if (closingNow.current) return;
    const key = latest.current.resetKey;
    closingNow.current = true;
    setClosingFor({ key });
    setDy(0);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      if (Object.is(latest.current.resetKey, key)) {
        // 閉じた後も下に滑らせたまま（戻る動きを見せない）。要素が消える・隠れるときに元へ戻す
        latest.current.onClose();
        return;
      }
      // 閉じる途中で中身が替わっていたら閉じない
      closingNow.current = false;
      setClosingFor(null);
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    if (!el) return;
    let drag: Drag | null = null;
    let cur = 0;
    let suppressUntil = 0;
    const move = (v: number) => {
      cur = v;
      setDy(v);
    };
    const begin = (x: number, y: number, t: number, axis: "y" | null = null) => {
      if (!latest.current.enabled || closingNow.current) return false;
      drag = { x, y, axis, lastY: y, lastT: t, v: 0 };
      if (axis === "y") setDragging(true);
      return true;
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
      // 引いてから止めて離したときは、止まる前の速さを使わない（e.timeStamp と performance.now は同じ基準）
      if (swipeDecision(cur, d.v, performance.now() - d.lastT)) dismiss();
      else move(0);
    };
    // 引くのをやめて元に戻す（2 本目の指・OS やブラウザによる中断。閉じる操作ではない）
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
    // マウス・ペン：押して引く。離したのが要素の外でも受けられるよう、押している間は画面全体で待つ
    const onWindowUp = (e: PointerEvent) => {
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      if (e.type === "pointercancel") cancel();
      else release();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      const f = latest.current.mouseFilter;
      if (f && !(e.target instanceof Element && f(e.target))) return;
      // 引ける場所が決まっているとき（バーなど）は、縦を待たずに引き始める
      if (!begin(e.clientX, e.clientY, e.timeStamp, f ? "y" : null)) return;
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
      el.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      // 要素が消えた・隠れた（cacheComponents の Activity）ら、待っている onClose を取り消して戻す
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = undefined;
      closingNow.current = false;
      setClosingFor(null);
      setDragging(false);
      setDy(0);
    };
  }, [el, dismiss]);

  // attach は要素に ref={attach} で付ける（callback ref）。style は引いている・閉じている間の動き
  const style = {
    transform: closing ? "translateY(100%)" : `translateY(${dy}px)`,
    transition: dragging ? "none" : `transform ${CLOSE_MS}ms ${SWIPE_EASE}`,
  };
  return { style, attach: setEl, closing, dismiss };
}
