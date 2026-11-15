import type { PriceTable as PriceTableView } from "@/lib/accommodation/view";
import { Card } from "./Card";
import { priceNote } from "./format";
import { PriceRows } from "./PriceRows";

const HEAD = "border-b border-[rgba(20,20,19,.06)] px-0.5 pb-[7px] pt-0.5 text-[10px] font-semibold whitespace-nowrap text-[#8a867c]";
const COLUMNS = ["部屋", "人数", "最小", "最大", "備考"];

// 「料金（参考）」のカード。部屋ごとの最小〜最大だけ出す（区分ごとの値は出さない）
export function PriceTable({ table, labels }: { table: PriceTableView; labels?: { title?: string } }) {
  return (
    <Card title={labels?.title ?? "料金（参考）"}>
      <p className="m-0 mb-1 mt-0.5 text-[10.5px] text-[#8a867c]">{table.unitLabel}</p>
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            {COLUMNS.map((c, i) => (
              <th key={c} scope="col" className={`${HEAD} ${i === 0 ? "text-left" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <PriceRows rows={table.rows} fees={table.fees} childFees={table.children} />
      </table>
      <p className="m-0 mb-2 mt-1 text-[11px] leading-[1.7] text-[#8a867c]">{priceNote(table.fees)}</p>
      {table.officialUrl && (
        <a
          href={table.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2.5 block rounded-[10px] border border-[#d6d2c8] bg-white p-[9px] text-center text-[12.5px] font-semibold text-[#141413] no-underline"
        >
          料金の詳細は公式サイトへ
        </a>
      )}
    </Card>
  );
}
