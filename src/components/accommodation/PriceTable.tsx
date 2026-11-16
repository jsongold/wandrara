import type { PriceTable as PriceTableView } from "@/lib/accommodation/view";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { ExpandRow } from "../ExpandRow";
import { Card } from "./Card";
import { priceNote } from "./format";
import { PriceRows } from "./PriceRows";

const HEAD = "border-b border-[rgba(20,20,19,.06)] px-0.5 pb-[7px] pt-0.5 text-[10px] font-semibold whitespace-nowrap text-[#8a867c]";

// 「料金（参考）」のカード。部屋ごとの最小〜最大だけ出す（区分ごとの値は出さない）
// 大人の宿泊料が無い（rows が空）ときは、表を出さず別料金・子どもの料金の行だけ出す
export function PriceTable({ table, locale }: { table: PriceTableView; locale: Locale }) {
  const t = messages(locale).accommodation;
  const columns = [t.price.colRoom, t.price.colGuests, t.price.colMin, t.price.colMax, t.price.colNote];
  const hasRows = table.rows.length > 0;
  return (
    <Card title={t.title.price}>
      {table.unitLabel && <p className="m-0 mb-1 mt-0.5 text-[10.5px] text-[#8a867c]">{table.unitLabel}</p>}
      {hasRows ? (
        <>
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
            <PriceRows rows={table.rows} fees={table.fees} childFees={table.children} locale={locale} />
          </table>
          <p className="m-0 mb-2 mt-1 text-[11px] leading-[1.7] text-[#8a867c]">{priceNote(table.fees, locale)}</p>
        </>
      ) : (
        <div className="mb-1.5">
          {[...table.fees, ...table.children].map((x, i) => (
            <ExpandRow key={i} label={x.label} value={x.text} />
          ))}
        </div>
      )}
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
