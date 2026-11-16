"use client";

import { Fragment, useId, useState } from "react";
import type { ExperiencePriceTable as PriceTableView } from "@/lib/experience/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { Card } from "../accommodation/Card";
import { yen } from "../accommodation/format";

const HEAD = "border-b border-[rgba(20,20,19,.06)] px-0.5 pb-[7px] pt-0.5 text-[10px] font-semibold whitespace-nowrap text-[#8a867c]";

// 開いた行は下の線を消す（詳細がすぐ下につながるように）
const cell = (open: boolean, kind: "head" | "num" | "note") =>
  [
    "border-b px-0.5 py-[7px] font-medium",
    open ? "border-b-transparent" : "border-b-[rgba(20,20,19,.06)]",
    kind === "head" ? "text-left text-[#141413]" : "whitespace-nowrap text-right",
    kind === "num" ? "text-[#141413]" : kind === "note" ? "text-[10.5px] text-[#8a867c]" : "",
  ].join(" ");

// 「料金（参考）」のカード。コースごとの最小〜最大だけ出す。行を押すと内訳の文を開く
export function ExperiencePriceTable({ table, locale }: { table: PriceTableView; locale: Locale }) {
  const t = messages(locale).experience;
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const baseId = useId();
  if (!table.rows.length) return null;
  const columns = [t.price.colCourse, t.price.colPeople, t.price.colMin, t.price.colMax, t.price.colUnit];
  return (
    <Card title={t.title.price}>
      {table.unitLabel && <p className="m-0 mb-1 mt-0.5 text-[10.5px] text-[#8a867c]">{table.unitLabel}</p>}
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`${HEAD} ${i === 0 ? "text-left" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => {
            const tappable = r.notes.length > 0;
            const isOpen = tappable && !!open[i];
            const panelId = `${baseId}-${i}`;
            return (
              <Fragment key={i}>
                <tr
                  onClick={tappable ? () => setOpen((o) => ({ ...o, [i]: !o[i] })) : undefined}
                  className={tappable ? "cursor-pointer active:bg-[#efece4]" : undefined}
                >
                  <th scope="row" className={cell(isOpen, "head")}>
                    {tappable ? (
                      // キーボードでも開けるように、行の頭をボタンにする
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-inherit"
                      >
                        {r.courseLabel}
                      </button>
                    ) : (
                      r.courseLabel
                    )}
                  </th>
                  <td className={cell(isOpen, "num")}>{r.people ?? "—"}</td>
                  <td className={cell(isOpen, "num")}>{yen(r.min)}</td>
                  <td className={cell(isOpen, "num")}>{yen(r.max)}</td>
                  <td className={cell(isOpen, "note")}>
                    {r.perLabel}
                    {tappable && (
                      <span
                        aria-hidden
                        className={`ml-1 inline-block text-[#b5b0a5] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      >
                        ›
                      </span>
                    )}
                  </td>
                </tr>
                {tappable && (
                  <tr id={panelId} hidden={!isOpen}>
                    <td colSpan={5} className="p-0">
                      <div className="mb-1.5 mt-1 rounded-[10px] bg-[#f6f4ef] px-2.5 pb-1 pt-0.5">
                        {r.notes.map((n, j) => (
                          <p key={j} className="m-0 border-b border-[rgba(20,20,19,.06)] py-1.5 text-xs font-medium text-[#141413] last:border-b-0">
                            {n}
                          </p>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="m-0 mb-2 mt-1 text-[11px] leading-[1.7] text-[#8a867c]">{t.price.varies}</p>
      {table.officialUrl && (
        <a
          href={table.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2.5 block rounded-[10px] border border-[#d6d2c8] bg-white p-[9px] text-center text-[12.5px] font-semibold text-[#141413] no-underline"
        >
          {t.price.official}
        </a>
      )}
    </Card>
  );
}
