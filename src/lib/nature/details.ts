// 自然の details（jsonb）の形。形は docs/proposals/web-output-experience-nature.html。必須かどうかは quality.ts が決める
import { z } from "zod";
import { cautionSchema, currencySchema, dateSchema, sourceSchema, timeSchema } from "../accommodation/details.ts";
import { localizedTextSchema } from "../i18n/localized.ts";
import { ACCESS_MODES, AUDIENCES, DIFFICULTIES, RESTRICTION_KINDS } from "../vocab/nature.ts";

const nonneg = z.number().nonnegative();
const month = z.int().min(1).max(12);

export const seasonSchema = z.strictObject({ subject: localizedTextSchema, month_from: month, month_to: month });

export const hoursSchema = z.strictObject({
  always_open: z.boolean().optional(),
  open: timeSchema.optional(),
  close: timeSchema.optional(),
  closed_note: localizedTextSchema.optional(),
});

export const feeSchema = z
  .strictObject({
    audience: z.enum(AUDIENCES).optional(),
    amount: nonneg, // 無料は 0
    amount_max: nonneg.optional(),
    currency: currencySchema,
    note: localizedTextSchema.optional(),
  })
  .superRefine((f, ctx) => {
    if (f.amount_max !== undefined && f.amount > f.amount_max) ctx.addIssue({ code: "custom", path: ["amount_max"], message: "amount_max が amount より小さい" });
  });

export const accessSchema = z.strictObject({
  station: localizedTextSchema.optional(),
  mode: z.enum(ACCESS_MODES).optional(),
  minutes: z.int().nonnegative().optional(),
  parking: z.strictObject({ available: z.boolean(), spaces: z.int().nonnegative().optional(), paid: z.boolean().optional() }).optional(),
  route: localizedTextSchema.optional(),
});

export const trailKeySchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, "トレイルの key は英小文字・数字・_・- の 1〜40 文字");

export const trailSchema = z.strictObject({
  key: trailKeySchema,
  name: localizedTextSchema,
  distance_km: nonneg.optional(),
  elevation_gain_m: nonneg.optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  duration_minutes: z.int().positive().optional(),
});

export const restrictionSchema = z
  .strictObject({
    kind: z.enum(RESTRICTION_KINDS),
    note: localizedTextSchema.optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),
  })
  .superRefine((r, ctx) => {
    if (r.date_from !== undefined && r.date_to !== undefined && r.date_from > r.date_to)
      ctx.addIssue({ code: "custom", path: ["date_to"], message: "date_to が date_from より前" });
  });

export const natureDetailsSchema = z
  .strictObject({
    seasons: z.array(seasonSchema).optional(),
    hours: hoursSchema.optional(),
    fees: z.array(feeSchema).optional(),
    access: accessSchema.optional(), // 配列でなく 1 つ
    trails: z.array(trailSchema).optional(),
    restrictions: z.array(restrictionSchema).optional(),
    cautions: z.array(cautionSchema).optional(),
    sources: z.array(sourceSchema).optional(),
  })
  .superRefine((d, ctx) => {
    // trails[].key は dest の中で一意
    const seen = new Set<string>();
    (d.trails ?? []).forEach((t, i) => {
      if (seen.has(t.key)) ctx.addIssue({ code: "custom", path: ["trails", i, "key"], message: `トレイルの key が重なっている: ${t.key}` });
      seen.add(t.key);
    });
  });

export type NatureDetails = z.infer<typeof natureDetailsSchema>;
export type NatureSeason = z.infer<typeof seasonSchema>;
export type NatureHours = z.infer<typeof hoursSchema>;
export type NatureFee = z.infer<typeof feeSchema>;
export type NatureAccess = z.infer<typeof accessSchema>;
export type Trail = z.infer<typeof trailSchema>;
export type Restriction = z.infer<typeof restrictionSchema>;
