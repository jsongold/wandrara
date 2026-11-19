"use client";

// area-stories：エリアの一言。エリアに絞り込んだときだけ、ヘッダーのエリアの名前をボタンにし、押すと下に板（AreaPopup）を開いて項目のタイルを出す。
// 一覧を初めてスクロールしたときにも 1 回だけ自動で開く（エリアごと）。タイルを押すと全画面のストーリーで候補を順に見せる。
// 「探す」で扱う店の一覧のシートを重ねる。ストーリーはモーダルの <dialog>（後ろの画面にフォーカスが行かない。閉じたら押したタイルに戻る）
// 部品：AreaPopup（板）・StoryTiles（タイル）・StoryView（ストーリー 1 枚）・ShopSheet（扱う店の一覧）・OfferRow（店の 1 行）
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import type { HighlightGroup } from "@/lib/area-highlights";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { Icon } from "../icons";
import { AreaPopup } from "./AreaPopup";
import { markSeen, useSeen } from "./seen-store";
import { nextPos, prevPos, type StoryPos } from "./story-nav";
import { StoryTiles } from "./StoryTiles";
import { StoryView } from "./StoryView";

// scrollRoot：一覧（スクロールする要素）。初めてスクロールしたら板を開く
type Props = { locale: Locale; area: string; areaLabel: string; groups: HighlightGroup[]; scrollRoot?: RefObject<HTMLElement | null> };
type OpenState = { area: string; pos: StoryPos; sheet: boolean };

export function AreaStories({ locale, area, areaLabel, groups, scrollRoot }: Props) {
  const m = messages(locale).highlights;
  const closeLabel = messages(locale).common.close;
  const seen = useSeen(area);
  const [state, setState] = useState<OpenState | null>(null);
  // エリアが変わったら閉じる
  const open = state?.area === area ? state.pos : null;
  const sheetOpen = open !== null && state?.sheet === true;

  const setOpen = (next: StoryPos | null) => {
    // 開いた項目を「見た」にする
    if (next && groups[next.g]) markSeen(area, groups[next.g].kind);
    setState(next ? { area, pos: next, sheet: false } : null);
  };
  const setSheet = (v: boolean) => setState((s) => (s ? { ...s, sheet: v } : s));

  // シートを閉じたら「探す」にフォーカスを戻す（inert が外れてから）
  const findRef = useRef<HTMLButtonElement>(null);
  const wasSheet = useRef(false);
  useEffect(() => {
    if (!sheetOpen && wasSheet.current) findRef.current?.focus();
    wasSheet.current = sheetOpen;
  }, [sheetOpen]);

  // dialog の開け閉め。閉じたら押したタイルにフォーカスを戻す
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = open !== null;
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) {
      d.close();
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  // 板（AreaPopup）の開け閉め。開いているエリアを持つ（エリアが変わったら閉じる）
  const [popupFor, setPopupFor] = useState<string | null>(null);
  const popupOpen = popupFor === area;
  const popupId = useId();
  const areaButtonRef = useRef<HTMLButtonElement>(null);
  const closePopup = useCallback(() => setPopupFor(null), []);
  // × で閉じたら、エリアの名前にフォーカスを戻す
  const closePopupByButton = () => {
    setPopupFor(null);
    areaButtonRef.current?.focus();
  };

  // 一覧を初めてスクロールしたら、1 回だけ自動で開く（エリアごと。閉じた後にまた開くことはしない）
  const autoOpened = useRef(new Set<string>());
  const hasGroups = groups.length > 0;
  useEffect(() => {
    const el = scrollRoot?.current;
    if (!el || !hasGroups || autoOpened.current.has(area)) return;
    const onScroll = () => {
      if (el.scrollTop <= 8 || autoOpened.current.has(area)) return;
      autoOpened.current.add(area);
      setPopupFor(area);
      el.removeEventListener("scroll", onScroll);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [area, scrollRoot, hasGroups]);

  // Esc で板を閉じる（ストーリーを開いている間は、ストーリーの Esc に任せる）
  useEffect(() => {
    if (!popupOpen || isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopupByButton();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ← → で前後（シートを開いていないとき）
  useEffect(() => {
    if (!open || sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen(nextPos(groups, open));
      if (e.key === "ArrowLeft") setOpen(prevPos(groups, open));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (groups.length === 0) return null;
  const group = open ? groups[open.g] : null;
  const item = open && group ? group.items[open.i] : null;
  const unread = groups.some((g) => !seen.includes(g.kind));
  // 板の下の一文。旬があれば旬の 1 件目、無ければ最初の項目の 1 件目
  const lineGroup = groups.find((g) => g.kind === "shun") ?? groups[0];
  const lineItem = lineGroup.items[0];
  const line = lineItem ? `${m.kind[lineGroup.kind]} · ${lineItem.name}：${lineItem.note}` : null;

  return (
    <>
      {/* エリアの名前。押すと板を開け閉めする。まだ見ていない項目があれば右上に点 */}
      <button
        ref={areaButtonRef}
        type="button"
        onClick={() => {
          // 自分で開け閉めしたら、自動では開かない
          autoOpened.current.add(area);
          setPopupFor(popupOpen ? null : area);
        }}
        aria-expanded={popupOpen}
        aria-controls={popupId}
        aria-label={m.label(areaLabel)}
        data-testid="area-popup-button"
        className="filter-mark-in relative flex min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-white"
      >
        <span className="truncate text-[21px] font-semibold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">{areaLabel}</span>
        <span aria-hidden="true" className="flex-none transition-transform duration-300 motion-reduce:transition-none" style={{ transform: popupOpen ? "rotate(180deg)" : "none" }}>
          <Icon name="chevron-down" size={18} />
        </span>
        {unread && <span aria-hidden="true" data-testid="area-popup-unread" className="absolute -right-2 top-0 h-1.5 w-1.5 rounded-full bg-[#f2a23a]" />}
      </button>
      <AreaPopup id={popupId} open={popupOpen} label={m.label(areaLabel)} closeLabel={closeLabel} onClose={closePopup} onCloseButton={closePopupByButton} line={line}>
        <StoryTiles
          groups={groups}
          seen={seen}
          label={m.label(areaLabel)}
          m={m}
          onOpen={(g, trigger) => {
            triggerRef.current = trigger;
            setOpen({ g, i: 0 });
          }}
        />
      </AreaPopup>
      {/* Esc はブラウザの cancel で受け、シートを先に閉じる。dialog は top layer に出るので、アプリの幅（480px）に合わせて置く */}
      <dialog
        ref={dialogRef}
        aria-label={group ? m.kind[group.kind] : undefined}
        onCancel={(e) => {
          e.preventDefault();
          if (sheetOpen) setSheet(false);
          else setOpen(null);
        }}
        className="m-0 mx-auto h-[100dvh] max-h-none w-full max-w-[480px] border-0 bg-transparent p-0 text-white backdrop:bg-black/60"
      >
        {open && group && item && (
          <StoryView
            group={group}
            item={item}
            pos={open}
            areaLabel={areaLabel}
            m={m}
            closeLabel={closeLabel}
            sheetOpen={sheetOpen}
            findRef={findRef}
            onClose={() => setOpen(null)}
            onPrev={() => setOpen(prevPos(groups, open))}
            onNext={() => setOpen(nextPos(groups, open))}
            onFind={() => setSheet(true)}
            onCloseSheet={() => setSheet(false)}
          />
        )}
      </dialog>
    </>
  );
}
