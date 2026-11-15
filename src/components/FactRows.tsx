"use client";

import { useState } from "react";
import type { Messages } from "@/lib/i18n/messages";
import { useMessages } from "@/lib/i18n/use-locale";
import type { FactStatus, FactView } from "@/lib/types";
import { Icon } from "./icons";

const BADGE: Record<FactStatus, { label: (m: Messages) => string; className: string }> = {
  verified: { label: (m) => m.detail.verified, className: "bg-[#dcebe0] text-[#1f4d2e]" },
  unverified: { label: (m) => m.detail.unverified, className: "bg-[#f6e6cf] text-[#6b4210]" },
  unknown: { label: (m) => m.detail.unknown, className: "bg-[#e8e5dc] text-[#3d3b35]" },
};

function sourceLine(f: FactView, m: Messages): string {
  if (!f.sourceName) return m.detail.noSource;
  return f.checkedAt ? m.detail.sourceChecked(f.sourceName, f.checkedAt) : m.detail.source(f.sourceName);
}

export function FactRows({ facts }: { facts: FactView[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const m = useMessages();
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
              <span className={f.value === null ? "text-sm text-[#55524a]" : "text-sm font-semibold"}>{f.value ?? m.detail.noValue}</span>
              <span className={`justify-self-end rounded-md px-2 py-[3px] text-[11px] font-semibold ${badge.className}`}>{badge.label(m)}</span>
              <span className="transition-transform duration-200" style={{ transform: `rotate(${isOpen ? 180 : 0}deg)` }}>
                <Icon name="chevron-down" size={16} />
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-1.5 px-4 pb-3.5">
                <p className="m-0 text-[13px] leading-[1.7] text-[#2b2a26]">
                  {f.detail ?? (f.status === "unknown" ? m.detail.unknownDetail : m.detail.noDetail)}
                </p>
                {f.sourceUrl && f.sourceName ? (
                  <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#55524a] underline">
                    {sourceLine(f, m)}
                  </a>
                ) : (
                  <p className="m-0 text-xs text-[#55524a]">{sourceLine(f, m)}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
