// 概要の下の丸い 1 行（「所要 90 分 — 予約 必要」）。label が無い項目は値だけ出す
const KEY = "text-[9.5px] font-bold tracking-[.08em] text-[#8a867c]";

export type PillItem = { label?: string | null; value: string | null };

export function SummaryPill({ items }: { items: PillItem[] }) {
  const shown = items.filter((i) => i.value);
  if (!shown.length) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 self-start rounded-[99px] bg-[#efece4] px-[11px] py-[5px] leading-none">
      {shown.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="mx-0.5 h-px w-3.5 bg-[#b9b4a8]" />}
          {it.label && <span className={KEY}>{it.label}</span>}
          <b className="text-[13px] font-semibold tabular-nums text-[#141413]">{it.value}</b>
        </span>
      ))}
    </div>
  );
}
