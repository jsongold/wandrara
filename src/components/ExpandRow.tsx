"use client";

import { Children, useId, useState, type ReactNode } from "react";

// 行の区切り線は兄弟の最後の行だけ消す（行を同じ親に並べて使う）
const ROW = "flex w-full items-baseline justify-between gap-2 py-2 text-[13px]";
const LABEL = "shrink-0 whitespace-nowrap text-xs text-[#8a867c]";
const VALUE = "min-w-0 break-words text-right font-medium text-[#141413]";

function hasContent(children: ReactNode): boolean {
  return Children.toArray(children).some((c) => c !== "");
}

// 事実の 1 行。children があるときだけ押せて、行のすぐ下に詳細を開く
export function ExpandRow({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!hasContent(children)) {
    return (
      <div className={`${ROW} border-b border-[rgba(20,20,19,.06)] last:border-b-0`}>
        <span className={LABEL}>{label}</span>
        <span className={VALUE}>{value}</span>
      </div>
    );
  }

  return (
    <div className="group">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`${ROW} cursor-pointer border-b bg-transparent px-0 text-left active:bg-[#efece4] group-last:border-b-0 ${
          open ? "border-b-transparent" : "border-b-[rgba(20,20,19,.06)]"
        }`}
      >
        <span className={LABEL}>{label}</span>
        <span className={VALUE}>
          {value}
          <span
            aria-hidden
            className={`ml-1.5 inline-block text-[13px] leading-none text-[#b5b0a5] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          >
            ›
          </span>
        </span>
      </button>
      <div id={panelId} hidden={!open} className="mb-2 rounded-[10px] bg-[#f6f4ef] px-2.5 pb-1 pt-0.5">
        {children}
      </div>
    </div>
  );
}

// 開いた詳細の中に並べる小さい行
export function SubRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[rgba(20,20,19,.06)] py-1.5 text-xs last:border-b-0">
      <span className="shrink-0 whitespace-nowrap text-[#8a867c]">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-[#141413]">{value}</span>
    </div>
  );
}
