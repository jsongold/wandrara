"use client";

// 詳細を下からスライドさせて全画面で出す。裏のフィードは動かさない。
// 閉じる：上端のバーの閉じるボタン・Esc・下に引く（本文がいちばん上のとき、画面のどこからでも）・ブラウザの戻る。
// 上端のバーは常に出ていて、写真を過ぎたら背景と名前が出る（名前と保存は DestDetail が SheetBarContent で差し込む）。
// 上がる動きは CSS（globals.css の .sheet-panel）。閉じるときは下へ滑らせてから戻る（router.back）。
// ブラウザの戻る（iOS の戻るスワイプなど）で閉じたときは、ブラウザ側の動きに任せる。
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useMessages } from "@/lib/i18n/use-locale";
import { Icon } from "./icons";
import { SheetBarContext, SheetCloseContext } from "./sheet-context";

const CLOSE_DISTANCE = 120; // これ以上引き下げたら閉じる（px）
const FLICK_SPEED = 0.6; // これより速く下へ払ったら、短くても閉じる（px/ms）
const FLICK_MIN = 30; // 払って閉じるときの最低の距離（px）
const FLICK_STALE_MS = 100; // 最後の動きからこれ以上止まっていたら、払ったとは見なさない（ms）
const LOCK_SLOP = 8; // 縦か横かを決めるまでの動き（px）
const SOLID_AT = 340; // ここまでスクロールしたらバーに背景を付ける（写真 420px の下の方）
const CLOSE_MS = 320; // globals.css の --sheet-close-ms と合わせる

export const SHEET_GLASS: CSSProperties = {
  background: "rgba(18,18,16,0.46)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

type Drag = { x: number; y: number; axis: "y" | "x" | null; lastY: number; lastT: number; v: number };

export function DetailSheet({ children, label }: { children: ReactNode; label?: string }) {
  const router = useRouter();
  const m = useMessages();
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [solid, setSolid] = useState(false);
  const [barSlot, setBarSlot] = useState<HTMLDivElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragYRef = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);

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
  // 隠れるときに「閉じている途中」を戻しておかないと、透明なパネルが画面を覆ってトップを押せなくなる。
  useEffect(() => () => {
    setClosing(false);
    setDragY(0);
    setDragging(false);
    setSolid(false);
    drag.current = null;
    dragYRef.current = 0;
    if (scroller.current) scroller.current.scrollTop = 0;
  }, []);

  const moveTo = useCallback((y: number) => { dragYRef.current = y; setDragY(y); }, []);

  // 引き終わり：遠くまで引いた・素早く払ったら閉じる。それ以外は元に戻す
  const release = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.axis !== "y") return;
    const y = dragYRef.current;
    // 引いてから止めて離したときは、止まる前の速さを使わない（e.timeStamp と performance.now は同じ基準）
    const flick = performance.now() - d.lastT < FLICK_STALE_MS && d.v > FLICK_SPEED;
    if (y > CLOSE_DISTANCE || (y > FLICK_MIN && flick)) close();
    else moveTo(0);
  }, [close, moveTo]);

  // 引くのをやめて元に戻す（2 本目の指が触れた＝ピンチなど、閉じる操作ではない）
  const cancelDrag = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.axis === "y") { setDragging(false); moveTo(0); }
  }, [moveTo]);

  // 指の動き。本文がいちばん上で、最初の動きが下向きの縦なら、パネルを指について動かす。
  // 横なら写真の切り替え（PhotoCarousel の横スクロール）に任せる。
  // 縦に引いている間はスクロールを止めたいので、passive: false の生のリスナーで受ける。
  // 上端のバーから引いても閉じられるよう、パネル全体で受ける（いちばん上かは本文のスクロールで見る）。
  useEffect(() => {
    const el = panel.current;
    const body = scroller.current;
    if (!el || !body) return;
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) { cancelDrag(); return; }
      if (closing) return;
      const t = e.touches[0];
      drag.current = { x: t.clientX, y: t.clientY, axis: null, lastY: t.clientY, lastT: e.timeStamp, v: 0 };
    }
    function onMove(e: TouchEvent) {
      const d = drag.current;
      if (!d || !body) return;
      if (e.touches.length !== 1) { cancelDrag(); return; }
      const t = e.touches[0];
      const dx = t.clientX - d.x, dy = t.clientY - d.y;
      if (d.axis === null) {
        if (Math.hypot(dx, dy) < LOCK_SLOP) return;
        // 縦で下向き、かつ本文がいちばん上のときだけ引く。それ以外はふつうのスクロールに任せる
        if (Math.abs(dy) > Math.abs(dx) && dy > 0 && body.scrollTop <= 0) { d.axis = "y"; setDragging(true); }
        else { drag.current = null; return; }
      }
      e.preventDefault();
      const dt = Math.max(1, e.timeStamp - d.lastT);
      d.v = (t.clientY - d.lastY) / dt;
      d.lastY = t.clientY; d.lastT = e.timeStamp;
      moveTo(Math.max(0, dy));
    }
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", release);
    el.addEventListener("touchcancel", release);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", release);
      el.removeEventListener("touchcancel", release);
    };
  }, [cancelDrag, closing, moveTo, release]);

  // マウスではバーの空いているところ（名前の上も）を掴んで引く。
  // 名前は portal でバーに差し込むので React のイベントはバーを通らない。パネルで受けて DOM の位置で見分ける
  function onBarPointerDown(e: PointerEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (e.pointerType === "touch" || !target.closest(".sheet-bar") || target.closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, axis: "y", lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onBarPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerType === "touch" || !dragging) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY; d.lastT = e.timeStamp;
    moveTo(Math.max(0, e.clientY - d.y));
  }
  function onBarPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") release();
  }

  return (
    <div data-sheet={closing ? "closing" : "open"} className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label ?? m.detail.sheetLabel}>
      <div
        ref={panel}
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={onBarPointerUp}
        onPointerCancel={onBarPointerUp}
        className="sheet-panel relative flex h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[#f7f6f2]"
        style={{
          transform: closing ? "translateY(100%)" : `translateY(${dragY}px)`,
          transition: dragging ? "none" : `transform ${CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
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
