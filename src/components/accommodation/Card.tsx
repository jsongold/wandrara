import type { ReactNode } from "react";

// 宿の詳細の 1 トピック。白い小さなカードに、小さな見出しラベルを付ける
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[14px] bg-white px-3.5 pb-1 pt-2.5 shadow-[0_1px_2px_rgba(20,20,19,.04)]">
      <h2 className="m-0 mb-0.5 text-[10.5px] font-bold tracking-[.08em] text-[#8a867c]">{title}</h2>
      {children}
    </section>
  );
}
