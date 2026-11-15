"use client";

import { Fragment, useId, useState } from "react";
import type { LabeledText, PriceTableRow } from "@/lib/accommodation/view";
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
export function PriceRows({ rows, fees, childFees }: { rows: PriceTableRow[]; fees: LabeledText[]; childFees: LabeledText[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const baseId = useId();

  return (
    <tbody>
      {rows.map((r, i) => {
        const manyMeals = r.mealsLabels.length > 1;
        const extra = [...fees, ...childFees, ...(manyMeals ? [{ label: "食事", text: r.mealsLabels.join("・") }] : [])];
        const note = manyMeals ? `${r.mealsLabels[0]}ほか` : (r.mealsLabels[0] ?? "");
        const tappable = extra.length > 0;
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
                  // キーボードでも開けるように、行の頭をボタンにする（押すと行の onClick に届く）
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-inherit"
                  >
                    {r.roomLabel}
                  </button>
                ) : (
                  r.roomLabel
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
