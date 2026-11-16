// 建物・日帰り温泉・まちで共通の details の部品（zod）。値の形は docs/proposals/web-output-building-hotspring-village.html
import { z } from "zod";
import { cautionSchema, currencySchema, dateSchema, localizedTextSchema, timeSchema } from "./accommodation/details.ts";
import { AUDIENCES } from "./vocab/building.ts";

const nonneg = z.number().nonnegative();
const month = z.int().min(1).max(12);

export { accessSchema } from "./nature/details.ts";
export { cautionSchema };

/** 営業時間。休みは曜日（1=月〜7=日）と文 */
export const hoursSchema = z.strictObject({
  open: timeSchema.optional(),
  close: timeSchema.optional(),
  last_entry: timeSchema.optional(),
  closed_weekdays: z.array(z.int().min(1).max(7)).optional(),
  closed_note: localizedTextSchema.optional(),
  note: localizedTextSchema.optional(),
});

// 料金の共通の欄（建物は label を足す）
export const feeShape = {
  audience: z.enum(AUDIENCES).optional(),
  age_min: z.int().nonnegative().optional(),
  age_max: z.int().nonnegative().optional(),
  amount: nonneg, // 無料は 0
  amount_max: nonneg.optional(),
  currency: currencySchema,
  tax_included: z.boolean().optional(),
  note: localizedTextSchema.optional(),
};

/** 料金 1 行の決まり（amount_max ≥ amount・age_max ≥ age_min） */
export function checkFee(f: { amount: number; amount_max?: number; age_min?: number; age_max?: number }, ctx: z.RefinementCtx) {
  if (f.amount_max !== undefined && f.amount > f.amount_max) ctx.addIssue({ code: "custom", path: ["amount_max"], message: "amount_max が amount より小さい" });
  if (f.age_min !== undefined && f.age_max !== undefined && f.age_min > f.age_max) ctx.addIssue({ code: "custom", path: ["age_max"], message: "age_max が age_min より小さい" });
}

/** 催し。日付か月のどちらかで時期を書く */
export const eventSchema = z
  .strictObject({
    name: localizedTextSchema,
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
    months: z.array(month).optional(),
    note: localizedTextSchema.optional(),
  })
  .superRefine((e, ctx) => {
    if (e.date_from !== undefined && e.date_to !== undefined && e.date_from > e.date_to)
      ctx.addIssue({ code: "custom", path: ["date_to"], message: "date_to が date_from より前" });
  });

export type PlaceHours = z.infer<typeof hoursSchema>;
export type PlaceEvent = z.infer<typeof eventSchema>;
