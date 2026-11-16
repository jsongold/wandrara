import type { CSSProperties, ReactNode } from "react";

const CHIP_ON: CSSProperties = { background: "#f4f1ea", color: "#141413", border: "1px solid #f4f1ea" };
const CHIP_OFF: CSSProperties = { background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)" };

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="h-10 cursor-pointer rounded-full px-3.5 text-[13px]"
      style={on ? CHIP_ON : CHIP_OFF}
    >
      {children}
    </button>
  );
}
