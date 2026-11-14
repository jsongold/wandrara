"use client";

// 実機での不具合を調べるための表示。URL に ?debug=1 を付けると、そのタブの間だけ画面の上に出る（?debug=0 で消える）。
// 操作を邪魔しないよう pointer-events: none。心拍が止まれば JavaScript が止まっている。
import { useEffect, useState } from "react";

const KEY = "wandrara:debug";

function describe(el: EventTarget | Element | null): string {
  if (!(el instanceof Element)) return String(el);
  const cls = el.getAttribute("class")?.split(" ").slice(0, 3).join(".") ?? "";
  const label = el.getAttribute("aria-label");
  return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${label ? `[${label.slice(0, 12)}]` : ""}`;
}

function readEnabled(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("debug");
    if (q === "1") sessionStorage.setItem(KEY, "1");
    if (q === "0") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function DebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [beat, setBeat] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState("");

  useEffect(() => {
    // URL と sessionStorage は描画後にしか読めない
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(readEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t0 = performance.now();
    let last = { x: 0, y: 0 };
    let scrolls = 0;
    let moves = 0;
    const push = (s: string) => setLines((prev) => [`${Math.round((performance.now() - t0) / 100) / 10}s ${s}`, ...prev].slice(0, 9));
    const onTouch = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) last = { x: t.clientX, y: t.clientY };
      if (e.type === "touchmove") { moves++; return; }
      push(`${e.type} ${describe(e.target)} cancelable=${e.cancelable} moves=${moves}`);
      if (e.type === "touchstart") moves = 0;
    };
    const onPointer = (e: PointerEvent) => push(`${e.type} ${describe(e.target)}`);
    const onClick = (e: MouseEvent) => push(`click ${describe(e.target)} prevented=${e.defaultPrevented}`);
    const onScroll = () => { scrolls++; };
    const onError = (e: ErrorEvent) => push(`ERROR ${e.message}`);
    const onRejection = (e: PromiseRejectionEvent) => push(`REJECT ${String(e.reason).slice(0, 60)}`);
    const onPageShow = (e: PageTransitionEvent) => push(`pageshow persisted=${e.persisted}`);
    const opts = { capture: true, passive: true } as const;
    for (const t of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) window.addEventListener(t, onTouch, opts);
    for (const t of ["pointerdown", "pointercancel", "pointerup"] as const) window.addEventListener(t, onPointer, opts);
    window.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, opts);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("pageshow", onPageShow);
    const timer = window.setInterval(() => {
      setBeat((b) => b + 1);
      const feed = document.querySelector("[data-home] > div") as HTMLElement | null;
      const hit = document.elementFromPoint(last.x, last.y);
      setState(`url=${location.pathname}${location.search} sheet=${document.documentElement.dataset.sheet ?? "-"} dialogs=${document.querySelectorAll("[role=dialog]").length} feedTop=${Math.round(feed?.scrollTop ?? -1)} scrolls=${scrolls} hit(${Math.round(last.x)},${Math.round(last.y)})=${describe(hit)}`);
    }, 250);
    return () => {
      for (const t of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) window.removeEventListener(t, onTouch, opts);
      for (const t of ["pointerdown", "pointercancel", "pointerup"] as const) window.removeEventListener(t, onPointer, opts);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, opts);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pageshow", onPageShow);
      window.clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="pointer-events-none fixed inset-x-1 top-1 z-[9999] max-h-[45dvh] overflow-hidden rounded bg-black/80 p-1.5 font-mono text-[10px] leading-[1.35] text-lime-300">
      <div>beat {beat}</div>
      <div className="break-all text-white">{state}</div>
      {lines.map((l, i) => <div key={i} className="break-all">{l}</div>)}
    </div>
  );
}
