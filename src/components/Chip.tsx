import type { ReactNode } from "react";

// 選べる項目。ピル（枠・塗り）にせず文字だけ。選択中は明るい色・太字・下線
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 cursor-pointer border-0 bg-transparent px-0 text-[14px] underline-offset-[6px] ${
        on ? "font-bold text-[#f4f1ea] underline decoration-2" : "font-normal text-white/65"
      }`}
    >
      {children}
    </button>
  );
}
