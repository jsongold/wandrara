"use client";

// area-popup：ヘッダーのエリアの名前から下に開く板。項目のタイルと一文を出す
// - 開く・閉じるは、エリアの名前から出てくる・戻っていく動き（0.32 秒）。閉じている間も DOM に残し、見えない・押せない（inert）
// - 閉じる：× か、上に払う
import type { ReactNode } from "react";
import { Icon } from "../icons";
import { useSwipeUp } from "../use-swipe-up";

const MOTION = "320ms cubic-bezier(0.32, 0.72, 0, 1)";

type Props = {
  id: string;
  open: boolean;
  label: string;
  closeLabel: string;
  // 上に払って閉じた
  onClose: () => void;
  // × で閉じた（フォーカスを戻す）
  onCloseButton: () => void;
  // 板の下の一文（旬の候補など）
  line: string | null;
  children: ReactNode;
};

export function AreaPopup({ id, open, label, closeLabel, onClose, onCloseButton, line, children }: Props) {
  const { attach, dy, dragging } = useSwipeUp<HTMLDivElement>(onClose, open);
  return (
    <div
      id={id}
      ref={attach}
      role="region"
      aria-label={label}
      inert={!open}
      data-testid="area-popup"
      data-open={open}
      className="absolute inset-x-3 top-full z-[1] flex flex-col gap-2.5 rounded-[14px] p-3 [touch-action:pan-x] motion-reduce:!transition-none"
      style={{
        background: "rgba(26,26,24,0.95)",
        backdropFilter: "blur(16px) saturate(1.2)",
        WebkitBackdropFilter: "blur(16px) saturate(1.2)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        transformOrigin: "160px 0",
        transform: open ? `translateY(${dy}px)` : "translateY(-16px) scale(0.92)",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        transition: dragging ? "none" : `transform ${MOTION}, opacity ${MOTION}, visibility 0s linear ${open ? "0s" : "320ms"}`,
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-auto">{children}</div>
        <button type="button" onClick={onCloseButton} aria-label={closeLabel} className="-mr-1 -mt-1 flex h-10 w-10 flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-white">
          <Icon name="close" size={20} />
        </button>
      </div>
      {line && <p className="m-0 border-t border-white/10 pt-2 text-[12px] leading-snug text-white/85">{line}</p>}
      {/* 上に払うと閉じることを示すつまみ */}
      <span aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-white/30" />
    </div>
  );
}
