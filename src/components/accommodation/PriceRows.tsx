"use client";

import { Fragment, useId, useState } from "react";
import type { LabeledText, PriceTableRow } from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { SubRow } from "../ExpandRow";
import { yen } from "./format";

// 開いた行は下の線を消す（詳細がすぐ下につながるように）
const cell = (open: boolean, kind: "head" | "num" | "note") =>
  [
    "border-b px-0.5 py-[7px] font-medium",
    open ? "border-b-transparent" : "border-b-[rgba(20,20,19,.06)]",
    kind === "head" ? "text-left text-[#141413]" : "whitespace-nowrap text-right",
    kind === "num" ? "text-[#141413]" : kind === "note" ? "text-[10.5px] text-[#8a867c]" : "",
  ].join(" ");

// 料金の表の中身。中身のある行は押すと、その行のすぐ下に別料金・子ども・食事を開く
export function PriceRows({
  rows,
  fees,
  childFees,
  locale,
}: {
  rows: PriceTableRow[];
  fees: LabeledText[];
  childFees: LabeledText[];
  locale: Locale;
}) {
  const t = messages(locale).accommodation;
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const baseId = useId();

  return (
    <tbody>
      {rows.map((r, i) => {
        const manyMeals = r.mealsLabels.length > 1;
        // 行だけの単位・条件を先に、そのあと別料金・子ども・食事
        const extra: LabeledText[] = [
          ...(r.unitLabel ? [{ label: t.price.unit, text: r.unitLabel }] : []),
          ...(r.note ? [{ label: t.price.conditions, text: r.note }] : []),
          ...fees,
          ...childFees,
          ...(manyMeals ? [{ label: t.price.meals, text: r.mealsLabels.join(t.sep) }] : []),
        ];
        const note = manyMeals ? t.price.mealsMore(r.mealsLabels[0]) : (r.mealsLabels[0] ?? "");
        const tappable = extra.length > 0;
        const isOpen = tappable && !!open[i];
        const panelId = `${baseId}-${i}`;
        // 表の単位と違う行は、部屋名の下に単位を小さく出す（min・max はその単位）
        const head = (
          <>
            {r.roomLabel}
            {r.unitLabel && <span className="block text-[10px] font-normal text-[#8a867c]">{r.unitLabel}</span>}
          </>
        );
        return (
          <Fragment key={i}>
            <tr
              onClick={tappable ? () => setOpen((o) => ({ ...o, [i]: !o[i] })) : undefined}
              className={tappable ? "cursor-pointer active:bg-[#efece4]" : undefined}
            >
              <th scope="row" className={cell(isOpen, "head")}>
                {tappable ? (
                  // キーボードでも開けるように、行の頭をボタンにする（押すと行の onClick に届く）
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-inherit"
                  >
                    {head}
                  </button>
                ) : (
                  head
                )}
              </th>
              <td className={cell(isOpen, "num")}>{r.guests ?? "—"}</td>
              <td className={cell(isOpen, "num")}>{yen(r.min)}</td>
              <td className={cell(isOpen, "num")}>{yen(r.max)}</td>
              <td className={cell(isOpen, "note")}>
                {note}
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
                    {extra.map((x, j) => (
                      <SubRow key={j} label={x.label} value={x.text} />
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </tbody>
  );
}
