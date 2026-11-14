"use client";

import { useState } from "react";
import type { FactStatus, FactView } from "@/lib/types";
import { Icon } from "./icons";

const BADGE: Record<FactStatus, { label: string; className: string }> = {
  verified: { label: "確認済み", className: "bg-[#dcebe0] text-[#1f4d2e]" },
  unverified: { label: "未検証", className: "bg-[#f6e6cf] text-[#6b4210]" },
  unknown: { label: "不明", className: "bg-[#e8e5dc] text-[#3d3b35]" },
};

function sourceLine(f: FactView): string {
  if (!f.sourceName) return "出典なし";
  return f.checkedAt ? `出典：${f.sourceName} · 確認日 ${f.checkedAt}` : `出典：${f.sourceName}`;
}

export function FactRows({ facts }: { facts: FactView[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2dfd6] bg-white">
      {facts.map((f, i) => {
        const isOpen = !!open[f.key];
        const badge = BADGE[f.status];
        return (
          <div key={f.key} className={i < facts.length - 1 ? "border-b border-[#ece9e1]" : ""}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [f.key]: !isOpen }))}
              aria-expanded={isOpen}
              className="grid min-h-12 w-full cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_16px] items-center gap-2 border-0 bg-transparent px-4 py-3 text-left text-[#141413]"
            >
              <span className="text-[13px] text-[#55524a]">{f.label}</span>
              <span className={f.value === null ? "text-sm text-[#55524a]" : "text-sm font-semibold"}>{f.value ?? "情報なし"}</span>
              <span className={`justify-self-end rounded-md px-2 py-[3px] text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
              <span className="transition-transform duration-200" style={{ transform: `rotate(${isOpen ? 180 : 0}deg)` }}>
                <Icon name="chevron-down" size={16} />
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-1.5 px-4 pb-3.5">
                <p className="m-0 text-[13px] leading-[1.7] text-[#2b2a26]">
                  {f.detail ?? (f.status === "unknown" ? "公式情報に記載がありません。直接確認してください。" : "詳細はまだありません。")}
                </p>
                {f.sourceUrl && f.sourceName ? (
                  <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#55524a] underline">
                    {sourceLine(f)}
                  </a>
                ) : (
                  <p className="m-0 text-xs text-[#55524a]">{sourceLine(f)}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
