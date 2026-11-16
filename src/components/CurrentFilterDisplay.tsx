// current-filter-display：今の絞り込みを見せる。今はエリアの名前だけ（例：箱根）。全エリアのときは label を null にして何も出さない
export function CurrentFilterDisplay({ label, className }: { label: string | null; className?: string }) {
  const text = label?.trim();
  if (!text) return null;
  return (
    <span
      key={text}
      role="status"
      title={text}
      data-testid="current-filter-display"
      className={`filter-mark-in pointer-events-none block min-w-0 truncate text-[21px] font-semibold leading-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.55)] ${className ?? ""}`}
    >
      {text}
    </span>
  );
}
