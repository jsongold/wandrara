"use client";

import { useState } from "react";

// ref（無ければ slug）をクリップボードにコピーする
export function CopyIdButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // コピーできないときは何もしない
        }
      }}
      className="whitespace-nowrap rounded-full border border-[#d6d3cb] bg-white px-3 py-1 text-[12px] text-[#171717]"
    >
      {done ? "コピーしました" : "ID をコピー"}
    </button>
  );
}
