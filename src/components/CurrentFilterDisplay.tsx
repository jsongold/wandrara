// current-filter-display：今の絞り込みを 1 文字で見せる。今はエリアだけ（例：箱根 → 箱、全エリア → 全）
export function filterMark(label: string): string {
  return Array.from(label.trim())[0] ?? "";
}

export function CurrentFilterDisplay({ label, className }: { label: string; className?: string }) {
  const mark = filterMark(label);
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      data-testid="current-filter-display"
      className={`pointer-events-none flex size-10 items-center justify-center rounded-full border border-white/60 bg-black/20 text-[19px] leading-none text-white [font-family:'Hiragino_Mincho_ProN','Yu_Mincho',serif] [text-shadow:0_1px_6px_rgba(0,0,0,0.55)] backdrop-blur-[6px] ${className ?? ""}`}
    >
      <span aria-hidden="true" key={mark} className="filter-mark-in">{mark}</span>
    </span>
  );
}
