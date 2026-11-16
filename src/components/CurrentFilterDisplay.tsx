// current-filter-display：今の絞り込みを 1 文字で見せる。今はエリアだけ（例：箱根 → 箱）。全エリアのときは label を null にして何も出さない
export function filterMark(label: string): string {
  return Array.from(label.trim())[0] ?? "";
}

export function CurrentFilterDisplay({ label, className }: { label: string | null; className?: string }) {
  if (label === null) return null;
  const mark = filterMark(label);
  if (!mark) return null;
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      data-testid="current-filter-display"
      className={`pointer-events-none flex h-10 items-center justify-center text-[26px] leading-none text-white [font-family:'Hiragino_Mincho_ProN','Yu_Mincho',serif] [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] ${className ?? ""}`}
    >
      <span aria-hidden="true" key={mark} className="filter-mark-in">{mark}</span>
    </span>
  );
}
